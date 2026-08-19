import Foundation
import UserNotifications

/**
 * BeenbyArrivalNotifications
 *
 * Local-notification layer for geofence arrivals.
 *
 * Deliberately NOT included:
 *   - push / APNs
 *   - any Supabase call
 *   - any visit registration
 *
 * Everything here is local to the device: UNUserNotificationCenter for the
 * notification itself and UserDefaults for the small amount of non-secret
 * metadata native needs when the app is not running.
 */
/// Notification texts for every language BeenBy supports.
///
/// The strings live here instead of in Localizable.strings so the plugin stays
/// self-contained: iOS picks the language from the phone's own preferred
/// languages, which is exactly what the web layer does with Device locale.
enum BeenbyArrivalStrings {

    private static let table: [String: [String: String]] = [
        "sv": ["yes": "Ja", "no": "Nej", "askName": "Är du hos %@? ❤️", "ask": "Är du framme? ❤️"],
        "en": ["yes": "Yes", "no": "No", "askName": "Are you at %@'s? ❤️", "ask": "Have you arrived? ❤️"],
        "de": ["yes": "Ja", "no": "Nein", "askName": "Bist du bei %@? ❤️", "ask": "Bist du angekommen? ❤️"],
        "da": ["yes": "Ja", "no": "Nej", "askName": "Er du hos %@? ❤️", "ask": "Er du fremme? ❤️"],
        "fi": ["yes": "Kyllä", "no": "Ei", "askName": "Oletko %@:n luona? ❤️", "ask": "Oletko perillä? ❤️"],
        "es": ["yes": "Sí", "no": "No", "askName": "¿Estás en casa de %@? ❤️", "ask": "¿Ya has llegado? ❤️"],
        "fr": ["yes": "Oui", "no": "Non", "askName": "Tu es chez %@ ? ❤️", "ask": "Tu es arrivé ? ❤️"]
    ]

    /// First supported base language among the phone's preferred languages.
    /// Regional variants map to the base language: de-DE → de, en-GB → en.
    static var language: String {
        for tag in Locale.preferredLanguages {
            let base = tag.split(whereSeparator: { $0 == "-" || $0 == "_" }).first.map(String.init)?.lowercased()
            if let base, table[base] != nil { return base }
        }
        return "en"
    }

    static func value(_ key: String) -> String {
        table[language]?[key] ?? table["en"]![key]!
    }

    static func arrivalBody(personName: String?) -> String {
        if let name = personName, !name.isEmpty {
            return String(format: value("askName"), name)
        }
        return value("ask")
    }
}

final class BeenbyArrivalNotifications: NSObject, UNUserNotificationCenterDelegate {

    static let shared = BeenbyArrivalNotifications()

    // MARK: - Constants (single place to tune)

    /// Notification category attached to every arrival notification.
    static let categoryIdentifier = "BEENBY_ARRIVAL"
    /// Action identifier for "Ja".
    static let actionYes = "BEENBY_ARRIVAL_YES"
    /// Action identifier for "Nej".
    static let actionNo = "BEENBY_ARRIVAL_NO"

    /// Minimum time between two arrival notifications for the SAME region.
    static let cooldownSeconds: TimeInterval = 4 * 60 * 60  // 4 hours

    // UserDefaults keys (no secret data is ever stored here).
    private static let regionMetaKey = "beenby.geofence.regionMeta"
    private static let cooldownKey = "beenby.geofence.cooldown"
    private static let pendingKey = "beenby.geofence.pendingConfirmations"

    private let defaults = UserDefaults.standard
    private let center = UNUserNotificationCenter.current()

    /// Called when the user taps "Ja" — used to emit a Capacitor event when the
    /// app happens to be running. The record is always persisted first.
    var onConfirmed: ((_ payload: [String: Any]) -> Void)?

    private override init() {
        super.init()
    }

    // MARK: - Setup

    /// Registers the BEENBY_ARRIVAL category and installs the delegate.
    ///
    /// The category is *merged* into any existing categories, and the previous
    /// delegate is kept as a fallback, so other notification features added
    /// later are not clobbered.
    func configure() {
        installDelegate()
        registerCategory()
    }

    private weak var previousDelegate: UNUserNotificationCenterDelegate?

    private func installDelegate() {
        if center.delegate === self { return }
        if let existing = center.delegate, existing !== self {
            previousDelegate = existing
        }
        center.delegate = self
    }

    private func registerCategory() {
        let yes = UNNotificationAction(
            identifier: Self.actionYes,
            title: BeenbyArrivalStrings.value("yes"),
            options: []  // handled natively, no need to open the app
        )
        let no = UNNotificationAction(
            identifier: Self.actionNo,
            title: BeenbyArrivalStrings.value("no"),
            options: []  // must NOT open the app
        )
        let category = UNNotificationCategory(
            identifier: Self.categoryIdentifier,
            actions: [yes, no],
            intentIdentifiers: [],
            options: []
        )

        center.getNotificationCategories { [weak self] existing in
            guard let self else { return }
            var merged = existing.filter { $0.identifier != Self.categoryIdentifier }
            merged.insert(category)
            self.center.setNotificationCategories(merged)
        }
    }

    // MARK: - Permissions

    static func string(for status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "notDetermined"
        }
    }

    func getPermissionStatus(_ completion: @escaping (String) -> Void) {
        center.getNotificationSettings { settings in
            completion(Self.string(for: settings.authorizationStatus))
        }
    }

    func requestPermission(_ completion: @escaping (String, Bool) -> Void) {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] granted, _ in
            // Never crash / never throw when the user says no.
            guard let self else {
                completion(granted ? "authorized" : "denied", granted)
                return
            }
            self.getPermissionStatus { status in
                completion(status, granted)
            }
        }
    }

    // MARK: - Region metadata (persisted so background triggers have context)

    struct RegionMeta {
        let identifier: String
        let familyCircleId: String
        let personId: String
        let personName: String?
    }

    private func regionMetaDict() -> [String: [String: String]] {
        defaults.dictionary(forKey: Self.regionMetaKey) as? [String: [String: String]] ?? [:]
    }

    func saveRegionMeta(identifier: String, familyCircleId: String, personId: String, personName: String?) {
        var all = regionMetaDict()
        var entry: [String: String] = [
            "identifier": identifier,
            "familyCircleId": familyCircleId,
            "personId": personId
        ]
        if let personName, !personName.isEmpty {
            entry["personName"] = personName
        }
        all[identifier] = entry
        defaults.set(all, forKey: Self.regionMetaKey)
    }

    func removeRegionMeta(identifier: String) {
        var all = regionMetaDict()
        all.removeValue(forKey: identifier)
        defaults.set(all, forKey: Self.regionMetaKey)

        var cooldowns = defaults.dictionary(forKey: Self.cooldownKey) as? [String: Double] ?? [:]
        cooldowns.removeValue(forKey: identifier)
        defaults.set(cooldowns, forKey: Self.cooldownKey)
    }

    func regionMeta(for identifier: String) -> RegionMeta? {
        // Prefer persisted metadata; fall back to parsing the identifier itself.
        if let entry = regionMetaDict()[identifier],
           let circleId = entry["familyCircleId"],
           let personId = entry["personId"] {
            return RegionMeta(identifier: identifier,
                              familyCircleId: circleId,
                              personId: personId,
                              personName: entry["personName"])
        }
        let parts = identifier.split(separator: ":").map(String.init)
        guard parts.count == 3, parts[0] == "beenby" else { return nil }
        return RegionMeta(identifier: identifier,
                          familyCircleId: parts[1],
                          personId: parts[2],
                          personName: nil)
    }

    // MARK: - Cooldown

    /// True when a notification may be shown for this region right now.
    private func passesCooldown(_ identifier: String) -> Bool {
        let cooldowns = defaults.dictionary(forKey: Self.cooldownKey) as? [String: Double] ?? [:]
        guard let last = cooldowns[identifier] else { return true }
        return Date().timeIntervalSince1970 - last >= Self.cooldownSeconds
    }

    private func markCooldown(_ identifier: String) {
        var cooldowns = defaults.dictionary(forKey: Self.cooldownKey) as? [String: Double] ?? [:]
        cooldowns[identifier] = Date().timeIntervalSince1970
        defaults.set(cooldowns, forKey: Self.cooldownKey)
    }

    // MARK: - Presenting the arrival notification

    /// Called from the geofence manager on didEnterRegion.
    /// Returns false when the identifier is not a BeenBy region or the region
    /// is still within its cooldown window.
    @discardableResult
    func presentArrivalNotification(identifier: String) -> Bool {
        guard let meta = regionMeta(for: identifier) else { return false }
        guard passesCooldown(identifier) else { return false }
        markCooldown(identifier)

        let content = UNMutableNotificationContent()
        content.title = "BeenBy"
        content.body = BeenbyArrivalStrings.arrivalBody(personName: meta.personName)
        content.sound = .default
        content.categoryIdentifier = Self.categoryIdentifier
        content.userInfo = [
            "geofenceIdentifier": meta.identifier,
            "familyCircleId": meta.familyCircleId,
            "personId": meta.personId,
            "personName": meta.personName ?? ""
        ]

        let request = UNNotificationRequest(
            identifier: "beenby.arrival.\(identifier).\(Int(Date().timeIntervalSince1970))",
            content: content,
            trigger: nil  // deliver immediately
        )
        center.add(request, withCompletionHandler: nil)
        return true
    }

    // MARK: - Pending confirmations ("Ja")

    func pendingConfirmations() -> [[String: Any]] {
        defaults.array(forKey: Self.pendingKey) as? [[String: Any]] ?? []
    }

    private func appendPendingConfirmation(meta: RegionMeta) -> [String: Any] {
        let record: [String: Any] = [
            "id": UUID().uuidString,
            "geofenceIdentifier": meta.identifier,
            "familyCircleId": meta.familyCircleId,
            "personId": meta.personId,
            "personName": meta.personName ?? "",
            "respondedAt": ISO8601DateFormatter().string(from: Date())
        ]
        var all = pendingConfirmations()
        all.append(record)
        defaults.set(all, forKey: Self.pendingKey)
        return record
    }

    func clearPendingConfirmation(id: String) -> Bool {
        let all = pendingConfirmations()
        let filtered = all.filter { ($0["id"] as? String) != id }
        defaults.set(filtered, forKey: Self.pendingKey)
        return filtered.count != all.count
    }

    // MARK: - UNUserNotificationCenterDelegate

    public func userNotificationCenter(_ center: UNUserNotificationCenter,
                                       willPresent notification: UNNotification,
                                       withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let isArrival = notification.request.content.categoryIdentifier == Self.categoryIdentifier
        if isArrival {
            if #available(iOS 14.0, *) {
                completionHandler([.banner, .sound, .list])
            } else {
                completionHandler([.alert, .sound])
            }
            return
        }
        if let previousDelegate,
           previousDelegate.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))) {
            previousDelegate.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
            return
        }
        completionHandler([])
    }

    public func userNotificationCenter(_ center: UNUserNotificationCenter,
                                       didReceive response: UNNotificationResponse,
                                       withCompletionHandler completionHandler: @escaping () -> Void) {
        let content = response.notification.request.content
        guard content.categoryIdentifier == Self.categoryIdentifier else {
            if let previousDelegate,
               previousDelegate.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))) {
                previousDelegate.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
            } else {
                completionHandler()
            }
            return
        }

        switch response.actionIdentifier {
        case Self.actionYes:
            let info = content.userInfo
            let identifier = info["geofenceIdentifier"] as? String ?? ""
            let meta = regionMeta(for: identifier) ?? RegionMeta(
                identifier: identifier,
                familyCircleId: info["familyCircleId"] as? String ?? "",
                personId: info["personId"] as? String ?? "",
                personName: info["personName"] as? String
            )
            // Persist FIRST so the answer can never be lost, then notify JS.
            let record = appendPendingConfirmation(meta: meta)
            onConfirmed?(record)
        default:
            // "Nej" and plain dismissals: do nothing at all.
            break
        }

        completionHandler()
    }
}
