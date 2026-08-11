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
    func startMonitoring(identifier: String, latitude: Double, longitude: Double, radius: Double) -> Result<Double, String> {
        guard isMonitoringAvailable else {
            return .failure("Region monitoring is not available on this device")
        }
        let effectiveRadius = clampedRadius(radius)
        let center = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        guard CLLocationCoordinate2DIsValid(center) else {
            return .failure("Invalid coordinates")
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
        var payload: [String: Any] = ["identifier": region.identifier]
        if let circular = region as? CLCircularRegion {
            payload["latitude"] = circular.center.latitude
            payload["longitude"] = circular.center.longitude
            payload["radius"] = circular.radius
        }
        // Show the local arrival notification natively — this must work even
        // when the app is not running, so it cannot depend on JS.
        BeenbyArrivalNotifications.shared.presentArrivalNotification(identifier: region.identifier)

        // Also forward the event to JS when the app happens to be running.
        onEnter?(payload)
    }

    func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
        var payload: [String: Any] = ["message": error.localizedDescription]
        if let identifier = region?.identifier {
            payload["identifier"] = identifier
        }
        onError?(payload)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        onError?(["message": error.localizedDescription])
    }
}
