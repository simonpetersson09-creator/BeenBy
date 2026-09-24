package app.beenbys.billing;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Google Play Billing for BeenBy Premium (Android only).
 *
 * Mirrors the BeenbyStoreKit JS contract, but hands the backend Google's
 * `purchaseToken` instead of Apple's JWS. The device never decides Premium:
 * the server verifies the token with the Play Developer API.
 */
@CapacitorPlugin(name = "BeenbyPlayBilling")
public class BeenbyPlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private static final String DEFAULT_PRODUCT = "com.beenbys.premium.monthly";

    private BillingClient client;
    private PluginCall pendingPurchase;
    private String pendingProductId;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    // MARK: - connection

    private interface Ready { void run(); }

    private void whenReady(PluginCall call, Ready ready) {
        if (client.isReady()) {
            ready.run();
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    ready.run();
                } else {
                    call.reject("billing-unavailable: " + result.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // enableAutoServiceReconnection() reconnects on the next call.
            }
        });
    }

    private String productId(PluginCall call) {
        String id = call.getString("productId");
        return id == null || id.isEmpty() ? DEFAULT_PRODUCT : id;
    }

    // MARK: - status

    private void queryActive(PluginCall call, String productId, java.util.function.Consumer<Purchase> done) {
        whenReady(call, () -> client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
            (result, purchases) -> {
                Purchase found = null;
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
                    for (Purchase p : purchases) {
                        if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED && p.getProducts().contains(productId)) {
                            found = p;
                            break;
                        }
                    }
                }
                if (found != null) acknowledgeIfNeeded(found);
                done.accept(found);
            }));
    }

    @PluginMethod
    public void getSubscriptionStatus(PluginCall call) {
        String productId = productId(call);
        queryActive(call, productId, purchase -> {
            JSObject r = new JSObject();
            r.put("isPremium", purchase != null);
            if (purchase != null) {
                r.put("productId", productId);
                r.put("purchaseToken", purchase.getPurchaseToken());
            }
            call.resolve(r);
        });
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        String productId = productId(call);
        queryActive(call, productId, purchase -> {
            JSObject r = new JSObject();
            r.put("restored", purchase != null);
            if (purchase != null) r.put("purchaseToken", purchase.getPurchaseToken());
            call.resolve(r);
        });
    }

    // MARK: - product info

    private void loadProduct(PluginCall call, String productId, java.util.function.Consumer<ProductDetails> done) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()))
            .build();
        whenReady(call, () -> client.queryProductDetailsAsync(params, (result, details) -> {
            List<ProductDetails> list = details == null ? null : details.getProductDetailsList();
            done.accept(list == null || list.isEmpty() ? null : list.get(0));
        }));
    }

    /** Offer with the most pricing phases = the free-trial offer when eligible. */
    private static ProductDetails.SubscriptionOfferDetails bestOffer(ProductDetails pd) {
        List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;
        ProductDetails.SubscriptionOfferDetails best = offers.get(0);
        for (ProductDetails.SubscriptionOfferDetails o : offers) {
            if (o.getPricingPhases().getPricingPhaseList().size() > best.getPricingPhases().getPricingPhaseList().size()) {
                best = o;
            }
        }
        return best;
    }

    @PluginMethod
    public void getProductInfo(PluginCall call) {
        String productId = productId(call);
        loadProduct(call, productId, pd -> {
            JSObject r = new JSObject();
            r.put("productId", productId);
            if (pd != null) {
                r.put("title", pd.getName());
                ProductDetails.SubscriptionOfferDetails offer = bestOffer(pd);
                if (offer != null) {
                    List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                    // The last phase is the recurring price (after any free trial).
                    if (!phases.isEmpty()) r.put("displayPrice", phases.get(phases.size() - 1).getFormattedPrice());
                }
            }
            call.resolve(r);
        });
    }

    // MARK: - purchase

    @PluginMethod
    public void purchasePremium(PluginCall call) {
        if (pendingPurchase != null) {
            call.resolve(new JSObject().put("outcome", "error").put("message", "purchase-in-progress"));
            return;
        }
        String productId = productId(call);
        String accountId = call.getString("appAccountToken");
        loadProduct(call, productId, pd -> {
            ProductDetails.SubscriptionOfferDetails offer = pd == null ? null : bestOffer(pd);
            if (pd == null || offer == null) {
                call.resolve(new JSObject().put("outcome", "error").put("message", "product-not-found"));
                return;
            }
            List<BillingFlowParams.ProductDetailsParams> items = new ArrayList<>();
            items.add(BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(pd)
                .setOfferToken(offer.getOfferToken())
                .build());
            BillingFlowParams.Builder flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(items);
            if (accountId != null && !accountId.isEmpty()) flow.setObfuscatedAccountId(accountId);

            pendingPurchase = call;
            pendingProductId = productId;
            getActivity().runOnUiThread(() -> {
                BillingResult launch = client.launchBillingFlow(getActivity(), flow.build());
                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    finishPurchase(new JSObject().put("outcome", "error").put("message", launch.getDebugMessage()));
                }
            });
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            finishPurchase(new JSObject().put("outcome", "cancelled"));
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK || purchases == null) {
            finishPurchase(new JSObject().put("outcome", "error").put("message", result.getDebugMessage()));
            return;
        }
        for (Purchase p : purchases) {
            if (pendingProductId != null && !p.getProducts().contains(pendingProductId)) continue;
            JSObject r = new JSObject();
            r.put("productId", pendingProductId);
            r.put("purchaseToken", p.getPurchaseToken());
            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                acknowledgeIfNeeded(p);
                r.put("outcome", "success");
            } else {
                r.put("outcome", "pending");
            }
            finishPurchase(r);
            return;
        }
        finishPurchase(new JSObject().put("outcome", "error").put("message", "no-matching-purchase"));
    }

    private void finishPurchase(JSObject result) {
        PluginCall call = pendingPurchase;
        pendingPurchase = null;
        pendingProductId = null;
        if (call != null) call.resolve(result);
    }

    /** Google refunds unacknowledged purchases after 3 days. The server acknowledges too. */
    private void acknowledgeIfNeeded(Purchase p) {
        if (p.isAcknowledged() || p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;
        client.acknowledgePurchase(
            AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),
            r -> { /* ignore — server verification is the source of truth */ });
    }

    // MARK: - manage / anchor

    @PluginMethod
    public void manageSubscription(PluginCall call) {
        String url = "https://play.google.com/store/account/subscriptions?sku=" + Uri.encode(productId(call))
            + "&package=" + Uri.encode(getContext().getPackageName());
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("cannot-open-play-store");
        }
    }

    /**
     * Stable per-device id (ANDROID_ID is scoped to this app's signing key and
     * survives reinstall), hashed so the raw id never leaves the phone.
     */
    @PluginMethod
    public void getDeviceAnchor(PluginCall call) {
        JSObject r = new JSObject();
        try {
            String raw = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
            if (raw != null && !raw.isEmpty()) {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] hash = md.digest(("beenby:" + raw).getBytes(StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder("android-");
                for (int i = 0; i < 16; i++) sb.append(String.format("%02x", hash[i]));
                r.put("anchor", sb.toString());
            }
        } catch (Exception ignored) {
        }
        call.resolve(r);
    }
}
