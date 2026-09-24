package app.beenbys.geofence;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

/**
 * Small persisted state for the Android geofence, mirroring the iOS
 * UserDefaults keys: region metadata (incl. coordinates so regions can be
 * re-registered after a reboot), per-region cooldown and pending "Ja" answers.
 * Nothing secret is ever stored here.
 */
final class GeofenceStore {

    static final long COOLDOWN_MS = 4L * 60L * 60L * 1000L; // 4 hours, same as iOS

    private static final String PREFS = "beenby.geofence";
    private static final String KEY_REGIONS = "regions";
    private static final String KEY_COOLDOWN = "cooldown";
    private static final String KEY_PENDING = "pendingConfirmations";

    private final SharedPreferences prefs;

    GeofenceStore(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // MARK: regions

    synchronized JSONObject regions() {
        try {
            return new JSONObject(prefs.getString(KEY_REGIONS, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    synchronized void saveRegion(String identifier, double lat, double lng, float radius,
                                 String familyCircleId, String personId, String personName) {
        try {
            JSONObject all = regions();
            JSONObject existing = all.optJSONObject(identifier);
            JSONObject entry = new JSONObject();
            entry.put("identifier", identifier);
            entry.put("latitude", lat);
            entry.put("longitude", lng);
            entry.put("radius", (double) radius);
            entry.put("familyCircleId", pick(familyCircleId, existing, "familyCircleId"));
            entry.put("personId", pick(personId, existing, "personId"));
            String name = pick(personName, existing, "personName");
            if (!name.isEmpty()) entry.put("personName", name);
            all.put(identifier, entry);
            prefs.edit().putString(KEY_REGIONS, all.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private static String pick(String value, JSONObject existing, String key) {
        if (value != null && !value.isEmpty()) return value;
        if (existing != null) return existing.optString(key, "");
        return "";
    }

    synchronized boolean removeRegion(String identifier) {
        JSONObject all = regions();
        boolean had = all.has(identifier);
        all.remove(identifier);
        JSONObject cooldowns = cooldowns();
        cooldowns.remove(identifier);
        prefs.edit()
            .putString(KEY_REGIONS, all.toString())
            .putString(KEY_COOLDOWN, cooldowns.toString())
            .apply();
        return had;
    }

    /** Region metadata, falling back to parsing beenby:<circle>:<person>. */
    synchronized JSONObject regionMeta(String identifier) {
        JSONObject entry = regions().optJSONObject(identifier);
        if (entry != null) return entry;
        String[] parts = identifier == null ? new String[0] : identifier.split(":");
        if (parts.length != 3 || !"beenby".equals(parts[0])) return null;
        try {
            JSONObject o = new JSONObject();
            o.put("identifier", identifier);
            o.put("familyCircleId", parts[1]);
            o.put("personId", parts[2]);
            return o;
        } catch (Exception e) {
            return null;
        }
    }

    // MARK: cooldown

    private JSONObject cooldowns() {
        try {
            return new JSONObject(prefs.getString(KEY_COOLDOWN, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** True (and marks the region) when a notification may be shown now. */
    synchronized boolean takeCooldown(String identifier) {
        JSONObject c = cooldowns();
        long now = System.currentTimeMillis();
        long last = c.optLong(identifier, 0L);
        if (last != 0L && now - last < COOLDOWN_MS) return false;
        try {
            c.put(identifier, now);
        } catch (Exception ignored) {
        }
        prefs.edit().putString(KEY_COOLDOWN, c.toString()).apply();
        return true;
    }

    // MARK: pending confirmations

    synchronized JSONArray pending() {
        try {
            return new JSONArray(prefs.getString(KEY_PENDING, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    synchronized JSONObject appendPending(JSONObject meta) {
        JSONObject record = new JSONObject();
        try {
            SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
            iso.setTimeZone(TimeZone.getTimeZone("UTC"));
            record.put("id", UUID.randomUUID().toString().toUpperCase(Locale.US));
            record.put("geofenceIdentifier", meta.optString("identifier", ""));
            record.put("familyCircleId", meta.optString("familyCircleId", ""));
            record.put("personId", meta.optString("personId", ""));
            record.put("personName", meta.optString("personName", ""));
            record.put("respondedAt", iso.format(new Date()));
            JSONArray all = pending();
            all.put(record);
            prefs.edit().putString(KEY_PENDING, all.toString()).apply();
        } catch (Exception ignored) {
        }
        return record;
    }

    synchronized boolean clearPending(String id) {
        JSONArray all = pending();
        JSONArray kept = new JSONArray();
        for (int i = 0; i < all.length(); i++) {
            JSONObject o = all.optJSONObject(i);
            if (o != null && !id.equals(o.optString("id"))) kept.put(o);
        }
        prefs.edit().putString(KEY_PENDING, kept.toString()).apply();
        return kept.length() != all.length();
    }
}
