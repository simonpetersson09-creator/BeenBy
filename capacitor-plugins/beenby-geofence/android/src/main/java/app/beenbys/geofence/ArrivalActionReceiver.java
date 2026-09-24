package app.beenbys.geofence;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

/** Handles the Ja/Nej buttons without opening the app (same as iOS). */
public class ArrivalActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        int notificationId = intent.getIntExtra(GeofenceBroadcastReceiver.EXTRA_NOTIFICATION_ID, 0);
        NotificationManagerCompat.from(context).cancel(notificationId);

        if (!GeofenceBroadcastReceiver.ACTION_YES.equals(intent.getAction())) return; // "Nej": nothing

        String identifier = intent.getStringExtra(GeofenceBroadcastReceiver.EXTRA_IDENTIFIER);
        GeofenceStore store = new GeofenceStore(context);
        JSONObject meta = store.regionMeta(identifier);
        if (meta == null) return;
        // Persist FIRST so the answer can never be lost, then notify JS.
        JSONObject record = store.appendPending(meta);
        BeenbyGeofencePlugin.emitConfirmed(record);
    }
}
