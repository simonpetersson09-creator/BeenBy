import CoreLocation
import Foundation

/**
 * BeenbyGeofenceManager
 *
 * Thin, long-lived wrapper around a single CLLocationManager instance used for
 * Core Location *region monitoring* only.
 *
 * Deliberately NOT included in this step:
 *   - continuous location updates (startUpdatingLocation)
 *   - allowsBackgroundLocationUpdates
 *   - local notifications / notification actions
 *   - any visit registration
 */
/// Errors that region monitoring can fail with. Swift.Result requires the
/// Failure type to conform to Error, so plain String is not allowed.
enum GeofenceError: LocalizedError {
    case monitoringUnavailable
    case invalidCoordinates

    var errorDescription: String? {
        switch self {
        case .monitoringUnavailable:
            return "Region monitoring is not available on this device"
        case .invalidCoordinates:
            return "Invalid coordinates"
        }
    }
}

final class BeenbyGeofenceManager: NSObject, CLLocationManagerDelegate {

    static let shared = BeenbyGeofenceManager()

    /// One long-lived manager for the whole app lifetime.
    private let manager = CLLocationManager()

    /// Emitted when a monitored region is entered.
    var onEnter: ((_ payload: [String: Any]) -> Void)?
    /// Emitted when monitoring fails or a request cannot be fulfilled.
    var onError: ((_ payload: [String: Any]) -> Void)?
    /// Emitted when the authorization status changes.
    var onAuthorizationChange: ((_ status: String) -> Void)?

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        // No background location updates: plain region monitoring is enough and
        // is delivered by iOS even when the app is not running.
    }

    // MARK: - Permissions

    var authorizationStatusString: String {
        Self.string(for: manager.authorizationStatus)
    }

    static func string(for status: CLAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .authorizedWhenInUse: return "whenInUse"
        case .authorizedAlways: return "always"
        @unknown default: return "notDetermined"
        }
    }

    func requestWhenInUse() {
        // Only meaningful while undetermined; iOS ignores repeat prompts otherwise.
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
    }

    /// iOS requires When In Use before Always can be escalated. If nothing has
    /// been granted yet we ask for When In Use first; the caller can escalate
    /// again once the status has become `whenInUse`.
    func requestAlways() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse:
            manager.requestAlwaysAuthorization()
        default:
            break
        }
    }

    // MARK: - Region monitoring

    var isMonitoringAvailable: Bool {
        CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self)
    }

    /// Clamps to what iOS actually supports for this device/hardware.
    func clampedRadius(_ requested: Double) -> Double {
        let maxRadius = manager.maximumRegionMonitoringDistance
        let safeMax = maxRadius > 0 ? maxRadius : 1000
        return min(max(requested, 1), safeMax)
    }

    @discardableResult
    func startMonitoring(identifier: String, latitude: Double, longitude: Double, radius: Double) -> Result<Double, GeofenceError> {
        guard isMonitoringAvailable else {
            return .failure(.monitoringUnavailable)
        }
        let effectiveRadius = clampedRadius(radius)
        let center = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        guard CLLocationCoordinate2DIsValid(center) else {
            return .failure(.invalidCoordinates)
        }

        // Replace any previous region with the same identifier so we never
        // accumulate duplicates for the same person.
        stopMonitoring(identifier: identifier)

        let region = CLCircularRegion(center: center, radius: effectiveRadius, identifier: identifier)
        region.notifyOnEntry = true
        region.notifyOnExit = false
        manager.startMonitoring(for: region)
        return .success(effectiveRadius)
    }

    @discardableResult
    func stopMonitoring(identifier: String) -> Bool {
        var stopped = false
        for region in manager.monitoredRegions where region.identifier == identifier {
            manager.stopMonitoring(for: region)
            stopped = true
        }
        return stopped
    }

    func monitoredRegions() -> [[String: Any]] {
        manager.monitoredRegions.compactMap { region in
            guard let circular = region as? CLCircularRegion else { return nil }
            return [
                "identifier": circular.identifier,
                "latitude": circular.center.latitude,
                "longitude": circular.center.longitude,
                "radius": circular.radius
            ]
        }
    }

    // MARK: - CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        onAuthorizationChange?(Self.string(for: manager.authorizationStatus))
    }

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard let circular = region as? CLCircularRegion else { return }

        // Do NOT notify yet. iOS region monitoring is coarse in the background
        // (cell/Wi-Fi based) and regularly fires several hundred metres away.
        // Verify with a fresh one-shot fix first; cooldown is only consumed if
        // the entry passes verification and a notification is actually shown.
        pendingVerifications[circular.identifier] = PendingEntry(region: circular, requestedAt: Date())
        manager.requestLocation()
    }

    /// A didEnterRegion event awaiting verification by a fresh location fix.
    private struct PendingEntry {
        let region: CLCircularRegion
        let requestedAt: Date
    }

    private var pendingVerifications: [String: PendingEntry] = [:]

    /// Reject fixes older than this — never verify with a stale cached position.
    private static let maxLocationAge: TimeInterval = 60
    /// Reject fixes whose horizontal accuracy is invalid or worse than this.
    private static let maxHorizontalAccuracy: CLLocationDistance = 300
    /// Stop waiting for a fix after this long.
    private static let verificationTimeout: TimeInterval = 120

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        prunePendingVerifications()
        guard !pendingVerifications.isEmpty, let location = locations.last else { return }

        // Freshness: ignore cached/stale fixes and keep waiting.
        let age = Date().timeIntervalSince(location.timestamp)
        if age > Self.maxLocationAge { return }

        // Accuracy: invalid (<0) or very poor (>300 m) fixes are not trustworthy.
        // Keep the pending entries and wait for a better fix instead of dropping
        // them all — the timeout prune cleans up if no good fix ever arrives.
        let accuracy = location.horizontalAccuracy
        if accuracy < 0 || accuracy > Self.maxHorizontalAccuracy { return }

        let pending = pendingVerifications
        pendingVerifications.removeAll()

        for (identifier, entry) in pending {
            let center = CLLocation(latitude: entry.region.center.latitude,
                                    longitude: entry.region.center.longitude)
            let distance = location.distance(from: center)
            let allowedDistance = entry.region.radius + max(accuracy, 0)
            guard distance <= allowedDistance else { continue }

            // Verified arrival: notify (this is also where cooldown starts) and
            // forward to JS when the app happens to be running.
            BeenbyArrivalNotifications.shared.presentArrivalNotification(identifier: identifier)
            onEnter?([
                "identifier": identifier,
                "latitude": entry.region.center.latitude,
                "longitude": entry.region.center.longitude,
                "radius": entry.region.radius
            ])
        }
    }

    private func prunePendingVerifications() {
        let now = Date()
        pendingVerifications = pendingVerifications.filter {
            now.timeIntervalSince($0.value.requestedAt) <= Self.verificationTimeout
        }
    }


    func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
        var payload: [String: Any] = ["message": error.localizedDescription]
        if let identifier = region?.identifier {
            payload["identifier"] = identifier
        }
        onError?(payload)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // A failed one-shot fix must not notify: drop pending entries silently
        // (cooldown untouched, so a later real arrival still works).
        pendingVerifications.removeAll()
        onError?(["message": error.localizedDescription])
    }

}
