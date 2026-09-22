import Capacitor
import Foundation
import StoreKit
import UIKit

/**
 * BeenbyAppReview — asks iOS to show Apple's native 1-5 star rating prompt.
 *
 * JS name: "BeenbyAppReview" (see src/lib/appReview.ts).
 * Apple decides whether the prompt is actually displayed (max 3 times/year).
 */
@objc(BeenbyAppReviewPlugin)
public class BeenbyAppReviewPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "BeenbyAppReviewPlugin"
    public let jsName = "BeenbyAppReview"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise)
    ]

    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive })
                ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first
            else {
                call.resolve(["requested": false])
                return
            }
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview(in: scene)
            }
            call.resolve(["requested": true])
        }
    }
}
