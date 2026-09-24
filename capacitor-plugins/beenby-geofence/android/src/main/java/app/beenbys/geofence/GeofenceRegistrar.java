package app.beenbys.geofence;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.tasks.Task;

import org.json.JSONObject;

import java.util.Collections;
import java.util.Iterator;

/** Wraps GeofencingClient. Used by the plugin and by the boot receiver. */
final class GeofenceRegistrar {

    /** Android recommends >= 100 m for reliable geofences. */
    static final float MIN_RADIUS = 100f;

    private GeofenceRegistrar() {}

    static boolean hasFineLocation(Context ctx) {
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    static PendingIntent pendingIntent(Context ctx) {
        Intent intent = new Intent(ctx, GeofenceBroadcastReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        // Geofencing needs to fill in the intent extras → must be mutable on S+.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getBroadcast(ctx, 4711, intent, flags);
    }

    @SuppressLint("MissingPermission")
    static Task<Void> add(Context ctx, String identifier, double lat, double lng, float radius) {
        Geofence fence = new Geofence.Builder()
            .setRequestId(identifier)
            .setCircularRegion(lat, lng, radius)
            .setExpirationDuration(Geofence.NEVER_EXPIRE)
            .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER)
            .build();
        GeofencingRequest request = new GeofencingRequest.Builder()
            // Same as iOS: no notification merely for already being inside.
            .setInitialTrigger(0)
            .addGeofence(fence)
            .build();
        GeofencingClient client = LocationServices.getGeofencingClient(ctx);
        return client.addGeofences(request, pendingIntent(ctx));
    }

    static void remove(Context ctx, String identifier) {
        LocationServices.getGeofencingClient(ctx).removeGeofences(Collections.singletonList(identifier));
    }

    /** Re-registers every stored region (after reboot / app update). */
    static void restoreAll(Context ctx) {
        if (!hasFineLocation(ctx)) return;
        JSONObject regions = new GeofenceStore(ctx).regions();
        Iterator<String> keys = regions.keys();
        while (keys.hasNext()) {
            JSONObject r = regions.optJSONObject(keys.next());
            if (r == null) continue;
            try {
                add(ctx, r.getString("identifier"), r.getDouble("latitude"), r.getDouble("longitude"),
                    (float) r.optDouble("radius", 200));
            } catch (Exception ignored) {
            }
        }
    }
}
