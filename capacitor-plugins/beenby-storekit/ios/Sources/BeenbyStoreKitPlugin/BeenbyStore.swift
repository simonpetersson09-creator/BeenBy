import Foundation
import StoreKit
import UIKit

/// StoreKit 2 implementation used by BeenbyStoreKitPlugin.
/// No StoreKit 1 (SKPaymentQueue) is used anywhere.
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

        func toJS() -> [String: Any] {
            var payload: [String: Any] = ["isPremium": isPremium, "source": "storekit"]
            if let productId { payload["productId"] = productId }
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
                expiresAt: transaction.expirationDate
            )
        }
        return Status(isPremium: false, productId: nil, expiresAt: nil)
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

    func purchase(productId: String?) async -> [String: Any] {
        let targetID = (productId?.isEmpty == false ? productId! : premiumProductID)
        do {
            let products = try await Product.products(for: [targetID])
            guard let product = products.first else {
                return ["outcome": "error", "message": "Product not found: \(targetID)"]
            }

            let result = try await product.purchase()

            switch result {
            case .success(let verification):
                switch verification {
                case .verified(let transaction):
                    await transaction.finish()
                    let status = await currentStatus()
                    return [
                        "outcome": "success",
                        "productId": transaction.productID,
                        "isPremium": status.isPremium
                    ]
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
            return [
                "restored": status.isPremium,
                "isPremium": status.isPremium,
                "message": error.localizedDescription
            ]
        }
        let status = await currentStatus()
        return ["restored": status.isPremium, "isPremium": status.isPremium]
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
}
