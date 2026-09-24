package app.beenbys.geofence;

import android.content.res.Resources;
import android.os.Build;
import android.os.LocaleList;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Arrival notification texts, picked from the phone's own languages. */
final class ArrivalStrings {

    private static final Map<String, String[]> TABLE = new HashMap<>();

    // yes, no, askName (%s = name), ask
    static {
        TABLE.put("sv", new String[] {"Ja", "Nej", "Är du hos %s? ❤️", "Är du framme? ❤️"});
        TABLE.put("en", new String[] {"Yes", "No", "Are you at %s's? ❤️", "Have you arrived? ❤️"});
        TABLE.put("de", new String[] {"Ja", "Nein", "Bist du bei %s? ❤️", "Bist du angekommen? ❤️"});
        TABLE.put("da", new String[] {"Ja", "Nej", "Er du hos %s? ❤️", "Er du fremme? ❤️"});
        TABLE.put("nb", new String[] {"Ja", "Nei", "Er du hos %s? ❤️", "Er du fremme? ❤️"});
        TABLE.put("fi", new String[] {"Kyllä", "Ei", "Oletko %s:n luona? ❤️", "Oletko perillä? ❤️"});
        TABLE.put("nl", new String[] {"Ja", "Nee", "Ben je bij %s? ❤️", "Ben je aangekomen? ❤️"});
        TABLE.put("es", new String[] {"Sí", "No", "¿Estás en casa de %s? ❤️", "¿Ya has llegado? ❤️"});
        TABLE.put("fr", new String[] {"Oui", "Non", "Tu es chez %s ? ❤️", "Tu es arrivé ? ❤️"});
        TABLE.put("it", new String[] {"Sì", "No", "Sei da %s? ❤️", "Sei arrivato? ❤️"});
        TABLE.put("pl", new String[] {"Tak", "Nie", "Jesteś u %s? ❤️", "Jesteś na miejscu? ❤️"});
        TABLE.put("pt", new String[] {"Sim", "Não", "Você está na casa de %s? ❤️", "Você chegou? ❤️"});
        TABLE.put("tr", new String[] {"Evet", "Hayır", "%s yanında mısın? ❤️", "Vardın mı? ❤️"});
        TABLE.put("ar", new String[] {"نعم", "لا", "هل أنت عند %s؟ ❤️", "هل وصلت؟ ❤️"});
    }

    private static String[] row() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            LocaleList list = Resources.getSystem().getConfiguration().getLocales();
            for (int i = 0; i < list.size(); i++) {
                String[] r = TABLE.get(base(list.get(i)));
                if (r != null) return r;
            }
        } else {
            String[] r = TABLE.get(base(Locale.getDefault()));
            if (r != null) return r;
        }
        return TABLE.get("en");
    }

    private static String base(Locale locale) {
        String lang = locale.getLanguage().toLowerCase(Locale.ROOT);
        if (lang.equals("no") || lang.equals("nn")) return "nb";
        return lang;
    }

    static String yes() { return row()[0]; }

    static String no() { return row()[1]; }

    static String body(String personName) {
        String[] r = row();
        if (personName != null && !personName.isEmpty()) return String.format(r[2], personName);
        return r[3];
    }
}
