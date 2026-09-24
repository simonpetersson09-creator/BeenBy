package app.beenbys.geofence;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;

import org.json.JSONObject;

import java.util.List;

/**
 * Receives geofence transitions from Google Play services — also when BeenBy
 * is not running — and shows the local "Är du hos …?" notification with
 * Ja/Nej actions. No network call, no visit registration here (same as iOS).
 */
public class GeofenceBroadcastReceiver extends BroadcastReceiver {

    static final String CHANNEL_ID = "beenby_arrival";
    static final String EXTRA_IDENTIFIER = "geofenceIdentifier";
    static final String EXTRA_NOTIFICATION_ID = "notificationId";
    static final String ACTION_YES = "app.beenbys.geofence.ARRIVAL_YES";
    static final String ACTION_NO = "app.beenbys.geofence.ARRIVAL_NO";

    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent event = GeofencingEvent.fromIntent(intent);
        if (event == null) return;
        if (event.hasError()) {
            BeenbyGeofencePlugin.emitError(null, "geofence error " + event.getErrorCode());
            return;
        }
        if (event.getGeofenceTransition() != Geofence.GEOFENCE_TRANSITION_ENTER) return;
        List<Geofence> fences = event.getTriggeringGeofences();
        if (fences == null) return;

        GeofenceStore store = new GeofenceStore(context);
        for (Geofence fence : fences) {
            String identifier = fence.getRequestId();
            JSONObject meta = store.regionMeta(identifier);
            if (meta == null) continue;
            BeenbyGeofencePlugin.emitEnter(meta);
            if (!store.takeCooldown(identifier)) continue;
            show(context, identifier, meta.optString("personName", ""));
        }
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel =
            new NotificationChannel(CHANNEL_ID, "BeenBy", NotificationManager.IMPORTANCE_HIGH);
        nm.createNotificationChannel(channel);
    }

    private static void show(Context context, String identifier, String personName) {
        NotificationManagerCompat nm = NotificationManagerCompat.from(context);
        if (!nm.areNotificationsEnabled()) return;
        ensureChannel(context);

        int notificationId = (identifier + System.currentTimeMillis()).hashCode();
        int immutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_beenby)
            .setContentTitle("BeenBy")
            .setContentText(ArrivalStrings.body(personName))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .addAction(0, ArrivalStrings.yes(), action(context, ACTION_YES, identifier, notificationId, immutable))
            .addAction(0, ArrivalStrings.no(), action(context, ACTION_NO, identifier, notificationId, immutable));

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            builder.setContentIntent(PendingIntent.getActivity(context, notificationId, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | immutable));
        }
        try {
            nm.notify(notificationId, builder.build());
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS revoked — never crash.
        }
    }

    private static PendingIntent action(Context context, String action, String identifier, int notificationId, int immutable) {
        Intent i = new Intent(context, ArrivalActionReceiver.class);
        i.setAction(action);
        i.putExtra(EXTRA_IDENTIFIER, identifier);
        i.putExtra(EXTRA_NOTIFICATION_ID, notificationId);
        int requestCode = (action + notificationId).hashCode();
        return PendingIntent.getBroadcast(context, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | immutable);
    }
}
