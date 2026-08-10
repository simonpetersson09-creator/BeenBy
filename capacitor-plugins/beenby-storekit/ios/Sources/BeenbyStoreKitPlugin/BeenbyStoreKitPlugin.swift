import Capacitor
import Foundation

/**
 * BeenbyStoreKit — Capacitor bridge for the StoreKit 2 implementation.
 *
 * JS name: "BeenbyStoreKit"  (must match registerPlugin("BeenbyStoreKit") in src/lib/storekit.ts)
 *
 * Methods exposed to JavaScript:
 *   - getSubscriptionStatus()
 *   - purchasePremium({ productId?: string })
 *   - restorePurchases()
 *   - manageSubscription()
 */
@objc(BeenbyStoreKitPlugin)
public class BeenbyStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "BeenbyStoreKitPlugin"
    public let jsName = "BeenbyStoreKit"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getSubscriptionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchasePremium", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscription", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProductInfo", returnType: CAPPluginReturnPromise)
    ]

    private let store = BeenbyStore.shared

    override public func load() {
        // Starts the Transaction.updates listener exactly once (guarded inside BeenbyStore).
        if #available(iOS 15.0, *) {
            store.startTransactionListener()
        }
    }

    // MARK: - getSubscriptionStatus

    @objc func getSubscriptionStatus(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.resolve(["isPremium": false, "source": "storekit"])
            return
        }
        Task {
            let status = await store.currentStatus()
            call.resolve(status.toJS())
        }
    }

    // MARK: - getProductInfo

    @objc func getProductInfo(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.resolve(["productId": call.getString("productId") ?? ""])
            return
        }
        let productId = call.getString("productId")
        Task {
            let info = await store.productInfo(productId: productId)
            call.resolve(info)
        }
    }

    // MARK: - purchasePremium

    @objc func purchasePremium(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.resolve(["outcome": "error", "message": "StoreKit 2 requires iOS 15 or later."])
            return
        }
        let productId = call.getString("productId")
        Task {
            let result = await store.purchase(productId: productId)
            call.resolve(result)
        }
    }

    // MARK: - restorePurchases

    @objc func restorePurchases(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.resolve(["restored": false, "message": "StoreKit 2 requires iOS 15 or later."])
            return
        }
        Task {
            let result = await store.restore()
            call.resolve(result)
        }
    }

    // MARK: - manageSubscription

    @objc func manageSubscription(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.reject("Subscription management requires iOS 15 or later.")
            return
        }
        Task { @MainActor in
            let error = await store.showManageSubscriptions()
            if let error {
                call.reject(error)
            } else {
                call.resolve()
            }
        }
    }
}
