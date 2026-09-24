package app.beenbys.geofence;

import android.Manifest;
import android.content.Context;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;

/**
 * BeenbyGeofence — Android implementation with the SAME JS contract as the iOS
 * plugin (see src/lib/geofence.ts). Uses the Google Play services Geofencing
 * API, which keeps working while the app is closed as long as the user has
 * granted "Allow all the time" location access.
 *
 * Status strings map onto the iOS values:
 *   notDetermined | whenInUse | always | denied
 */
@CapacitorPlugin(
    name = "BeenbyGeofence",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION }),
        @Permission(alias = "background", strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class BeenbyGeofencePlugin extends Plugin {

    private static BeenbyGeofencePlugin instance;
    private GeofenceStore store;

    @Override
    public void load() {
        instance = this;
        store = new GeofenceStore(getContext());
        GeofenceBroadcastReceiver.ensureChannel(getContext());
    }

    // MARK: - static event bridge (receivers may fire while JS is not running)

    static void emitEnter(JSONObject meta) {
        BeenbyGeofencePlugin p = instance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("identifier", meta.optString("identifier"));
        if (meta.has("latitude")) data.put("latitude", meta.optDouble("latitude"));
        if (meta.has("longitude")) data.put("longitude", meta.optDouble("longitude"));
        if (meta.has("radius")) data.put("radius", meta.optDouble("radius"));
        p.notifyListeners("geofenceEnter", data);
    }

    static void emitConfirmed(JSONObject record) {
        BeenbyGeofencePlugin p = instance;
        if (p == null) return;
        try {
            p.notifyListeners("geofenceConfirmed", JSObject.fromJSONObject(record));
        } catch (Exception ignored) {
        }
    }

    static void emitError(String identifier, String message) {
        BeenbyGeofencePlugin p = instance;
        if (p == null) return;
        JSObject data = new JSObject();
        if (identifier != null) data.put("identifier", identifier);
        data.put("message", message);
        p.notifyListeners("geofenceError", data);
    }

    // MARK: - Location permissions

    private boolean needsBackgroundPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q;
    }

    private String locationStatus() {
        PermissionState fg = getPermissionState("location");
        if (fg == PermissionState.GRANTED && GeofenceRegistrar.hasFineLocation(getContext())) {
            if (!needsBackgroundPermission() || getPermissionState("background") == PermissionState.GRANTED) {
                return "always";
            }
            return "whenInUse";
        }
        if (fg == PermissionState.PROMPT) return "notDetermined";
        return "denied";
    }

    private JSObject statusResult() {
        JSObject r = new JSObject();
        r.put("status", locationStatus());
        r.put("monitoringAvailable", true);
        return r;
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        call.resolve(statusResult());
    }

    @PluginMethod
    public void requestWhenInUsePermission(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            call.resolve(statusResult());
            return;
        }
        requestPermissionForAlias("location", call, "locationCallback");
    }

    @PermissionCallback
    private void locationCallback(PluginCall call) {
        String prev = locationStatus();
        notifyListeners("geofencePermissionChange", new JSObject().put("status", prev));
        call.resolve(statusResult());
    }

    @PluginMethod
    public void requestAlwaysPermission(PluginCall call) {
        // Android 11+: background access must be requested AFTER foreground
        // access, and the system sends the user to Settings for "Allow all the time".
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "alwaysAfterForegroundCallback");
            return;
        }
        requestBackground(call);
    }

    @PermissionCallback
    private void alwaysAfterForegroundCallback(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.resolve(statusResult());
            return;
        }
        requestBackground(call);
    }

    private void requestBackground(PluginCall call) {
        if (!needsBackgroundPermission() || getPermissionState("background") == PermissionState.GRANTED) {
            call.resolve(statusResult());
            return;
        }
        requestPermissionForAlias("background", call, "backgroundCallback");
    }

    @PermissionCallback
    private void backgroundCallback(PluginCall call) {
        notifyListeners("geofencePermissionChange", new JSObject().put("status", locationStatus()));
        call.resolve(statusResult());
    }

    // MARK: - Region monitoring

    @PluginMethod
    public void startMonitoringRegion(PluginCall call) {
        String identifier = call.getString("identifier");
        if (identifier == null || identifier.isEmpty()) {
            call.reject("identifier is required");
            return;
        }
        Double lat = call.getDouble("latitude");
        Double lng = call.getDouble("longitude");
        if (lat == null || lng == null) {
            call.reject("latitude and longitude are required");
            return;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            resolveFailure(call, identifier, "Invalid coordinates");
            return;
        }
        Double requested = call.getDouble("radius", 200.0);
        float radius = Math.max(GeofenceRegistrar.MIN_RADIUS, requested == null ? 200f : requested.floatValue());

        store.saveRegion(identifier, lat, lng, radius,
            call.getString("familyCircleId"), call.getString("personId"), call.getString("personName"));

        Context ctx = getContext();
        if (!GeofenceRegistrar.hasFineLocation(ctx)) {
            resolveFailure(call, identifier, "Location permission not granted");
            return;
        }
        try {
            final float effective = radius;
            GeofenceRegistrar.add(ctx, identifier, lat, lng, radius)
                .addOnSuccessListener(v -> {
                    JSObject r = new JSObject();
                    r.put("started", true);
                    r.put("identifier", identifier);
                    r.put("radius", (double) effective);
                    call.resolve(r);
                })
                .addOnFailureListener(e -> resolveFailure(call, identifier, e.getMessage() == null ? "geofence-error" : e.getMessage()));
        } catch (SecurityException e) {
            resolveFailure(call, identifier, "Location permission not granted");
        }
    }

    private void resolveFailure(PluginCall call, String identifier, String message) {
        emitError(identifier, message);
        JSObject r = new JSObject();
        r.put("started", false);
        r.put("identifier", identifier);
        r.put("message", message);
        call.resolve(r);
    }

    @PluginMethod
    public void stopMonitoringRegion(PluginCall call) {
        String identifier = call.getString("identifier");
        if (identifier == null || identifier.isEmpty()) {
            call.reject("identifier is required");
            return;
        }
        GeofenceRegistrar.remove(getContext(), identifier);
        boolean had = store.removeRegion(identifier);
        JSObject r = new JSObject();
        r.put("stopped", had);
        r.put("identifier", identifier);
        call.resolve(r);
    }

    @PluginMethod
    public void getMonitoredRegions(PluginCall call) {
        JSArray list = new JSArray();
        JSONObject regions = store.regions();
        Iterator<String> keys = regions.keys();
        while (keys.hasNext()) {
            JSONObject o = regions.optJSONObject(keys.next());
            if (o == null) continue;
            JSObject r = new JSObject();
            r.put("identifier", o.optString("identifier"));
            r.put("latitude", o.optDouble("latitude"));
            r.put("longitude", o.optDouble("longitude"));
            r.put("radius", o.optDouble("radius"));
            list.put(r);
        }
        call.resolve(new JSObject().put("regions", list));
    }

    // MARK: - Notifications

    private String notificationStatus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PermissionState s = getPermissionState("notifications");
            if (s == PermissionState.GRANTED) return "authorized";
            if (s == PermissionState.PROMPT) return "notDetermined";
            return "denied";
        }
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled() ? "authorized" : "denied";
    }

    @PluginMethod
    public void getNotificationPermissionStatus(PluginCall call) {
        call.resolve(new JSObject().put("status", notificationStatus()));
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || getPermissionState("notifications") == PermissionState.GRANTED) {
            String s = notificationStatus();
            call.resolve(new JSObject().put("status", s).put("granted", "authorized".equals(s)));
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationCallback");
    }

    @PermissionCallback
    private void notificationCallback(PluginCall call) {
        String s = notificationStatus();
        call.resolve(new JSObject().put("status", s).put("granted", "authorized".equals(s)));
    }

    // MARK: - Pending "Ja" answers

    @PluginMethod
    public void getPendingConfirmations(PluginCall call) {
        JSONArray all = store.pending();
        JSArray out = new JSArray();
        for (int i = 0; i < all.length(); i++) {
            JSONObject o = all.optJSONObject(i);
            if (o == null) continue;
            try {
                out.put(JSObject.fromJSONObject(o));
            } catch (Exception ignored) {
            }
        }
        call.resolve(new JSObject().put("confirmations", out));
    }

    @PluginMethod
    public void clearPendingConfirmation(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("id is required");
            return;
        }
        call.resolve(new JSObject().put("cleared", store.clearPending(id)));
    }
}
