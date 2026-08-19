import Foundation
import Security
import StoreKit
import UIKit

/// StoreKit 2 implementation used by BeenbyStoreKitPlugin.
/// No StoreKit 1 (SKPaymentQueue) is used anywhere.
///
/// The app never decides on its own that a user is Premium: every entitlement
/// is returned together with Apple's signed JWS (`jws`), which the BeenBy
/// server verifies against Apple's certificate chain before writing anything.
@available(iOS 15.0, *)
final class BeenbyStore {

    static let shared = BeenbyStore()

    // ─────────────────────────────────────────────────────────────
    // CHANGE THIS LINE to your real App Store Connect product ID:
    private let premiumProductID = "com.beenbys.premium.monthly"
    // ─────────────────────────────────────────────────────────────

    struct Status {
        var isPremium: Bool
        var productId: String?
        var expiresAt: Date?
        /// Apple's signed transaction — the only thing the server trusts.
        var jws: String?

        func toJS() -> [String: Any] {
            var payload: [String: Any] = ["isPremium": isPremium, "source": "storekit"]
            if let productId { payload["productId"] = productId }
            if let jws { payload["jws"] = jws }
            if let expiresAt {
                payload["expiresAt"] = ISO8601DateFormatter().string(from: expiresAt)
            }
            return payload
        }
    }

    private var updatesTask: Task<Void, Never>?
    private let listenerLock = NSLock()

    private init() {}

    deinit {
        updatesTask?.cancel()
    }

    // MARK: - Transaction.updates listener (started once)

    func startTransactionListener() {
        listenerLock.lock()
        defer { listenerLock.unlock() }
        guard updatesTask == nil else { return }

        updatesTask = Task.detached(priority: .background) { [premiumProductID] in
            for await update in Transaction.updates {
                guard !Task.isCancelled else { return }
                switch update {
                case .verified(let transaction):
                    if transaction.productID == premiumProductID {
                        await transaction.finish()
                    }
                case .unverified:
                    // Ignore unverified transactions — never grant Premium for them.
                    continue
                }
            }
        }
    }

    // MARK: - Entitlement check

    func currentStatus() async -> Status {
        for await entitlement in Transaction.currentEntitlements {
            guard case .verified(let transaction) = entitlement else { continue }
            guard transaction.productID == premiumProductID else { continue }
            if transaction.revocationDate != nil { continue }
            if let expirationDate = transaction.expirationDate, expirationDate <= Date() { continue }
            return Status(
                isPremium: true,
                productId: transaction.productID,
                expiresAt: transaction.expirationDate,
                jws: entitlement.jwsRepresentation
            )
        }
        return Status(isPremium: false, productId: nil, expiresAt: nil, jws: nil)
    }

    // MARK: - Product info (localised price straight from StoreKit)

    func productInfo(productId: String?) async -> [String: Any] {
        let targetID = (productId?.isEmpty == false ? productId! : premiumProductID)
        do {
            let products = try await Product.products(for: [targetID])
            guard let product = products.first else {
                return ["productId": targetID]
            }
            return [
                "productId": product.id,
                "displayPrice": product.displayPrice,
                "title": product.displayName
            ]
        } catch {
            return ["productId": targetID]
        }
    }

    // MARK: - Purchase

    /// `appAccountToken` is the BeenBy user id. Apple echoes it back in the
    /// server notifications, so a renewal can be matched to the right account
    /// even if the app never gets the chance to report the purchase itself.
    func purchase(productId: String?, appAccountToken: String?) async -> [String: Any] {
        let targetID = (productId?.isEmpty == false ? productId! : premiumProductID)
        do {
            let products = try await Product.products(for: [targetID])
            guard let product = products.first else {
                return ["outcome": "error", "message": "Product not found: \(targetID)"]
            }

            var options: Set<Product.PurchaseOption> = []
            if let appAccountToken, let uuid = UUID(uuidString: appAccountToken) {
                options.insert(.appAccountToken(uuid))
            }

            let result = try await product.purchase(options: options)

            switch result {
            case .success(let verification):
                switch verification {
                case .verified(let transaction):
                    await transaction.finish()
                    let status = await currentStatus()
                    var payload: [String: Any] = [
                        "outcome": "success",
                        "productId": transaction.productID,
                        "isPremium": status.isPremium
                    ]
                    payload["jws"] = status.jws ?? verification.jwsRepresentation
                    return payload
                case .unverified(_, let error):
                    return [
                        "outcome": "error",
                        "productId": targetID,
                        "message": "Purchase could not be verified: \(error.localizedDescription)"
                    ]
                }

            case .userCancelled:
                return ["outcome": "cancelled", "productId": targetID]

            case .pending:
                return ["outcome": "pending", "productId": targetID,
                        "message": "Purchase is pending approval."]

            @unknown default:
                return ["outcome": "error", "productId": targetID,
                        "message": "Unknown purchase result."]
            }
        } catch {
            return ["outcome": "error", "productId": targetID,
                    "message": error.localizedDescription]
        }
    }

    // MARK: - Restore

    func restore() async -> [String: Any] {
        do {
            try await AppStore.sync()
        } catch {
            // A failed sync (e.g. user dismissed the sign-in sheet) is not fatal —
            // still report the current entitlement state below.
            let status = await currentStatus()
            var payload: [String: Any] = [
                "restored": status.isPremium,
                "isPremium": status.isPremium,
                "message": error.localizedDescription
            ]
            if let jws = status.jws { payload["jws"] = jws }
            return payload
        }
        let status = await currentStatus()
        var payload: [String: Any] = ["restored": status.isPremium, "isPremium": status.isPremium]
        if let jws = status.jws { payload["jws"] = jws }
        return payload
    }

    // MARK: - Manage subscription

    @MainActor
    func showManageSubscriptions() async -> String? {
        guard let scene = activeWindowScene() else {
            return "No active window scene available."
        }
        do {
            try await AppStore.showManageSubscriptions(in: scene)
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    @MainActor
    private func activeWindowScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first(where: { $0.activationState == .foregroundActive })
            ?? scenes.first
    }

    // MARK: - Trial anchor (Keychain)

    /// A random UUID stored in the Keychain. Unlike UserDefaults or web storage
    /// it survives sign-out, "start over" and even deleting the app, so the free
    /// 30 day period can be tied to the device and never restarted.
    private let anchorService = "app.beenbys.trial"
    private let anchorAccount = "anchor"

    func deviceAnchor() -> String {
        if let existing = readAnchor() { return existing }
        let created = UUID().uuidString
        writeAnchor(created)
        return created
    }

    private func readAnchor() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: anchorService,
            kSecAttrAccount as String: anchorAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8),
              !value.isEmpty else { return nil }
        return value
    }

    private func writeAnchor(_ value: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: anchorService,
            kSecAttrAccount as String: anchorAccount
        ]
        SecItemDelete(base as CFDictionary)
        var attributes = base
        attributes[kSecValueData as String] = Data(value.utf8)
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attributes as CFDictionary, nil)
    }
}
