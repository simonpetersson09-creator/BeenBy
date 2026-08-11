import Capacitor
import CoreLocation
import Foundation

/**
 * BeenbyGeofence — Capacitor bridge for Core Location region monitoring.
 *
 * JS name: "BeenbyGeofence"  (must match registerPlugin("BeenbyGeofence") in src/lib/geofence.ts)
 *
 * Methods exposed to JavaScript:
 *   - getPermissionStatus()
 *   - requestWhenInUsePermission()
 *   - requestAlwaysPermission()
 *   - startMonitoringRegion({ identifier, latitude, longitude, radius })
 *   - stopMonitoringRegion({ identifier })
 *   - getMonitoredRegions()
 *
 * Events emitted to JavaScript:
 *   - "geofenceEnter"  { identifier, latitude?, longitude?, radius? }
 *   - "geofenceError"  { identifier?, message }
 *   - "geofencePermissionChange" { status }
 *
 * This plugin is intentionally neutral: it knows nothing about Premium,
 * visits or notifications.
 */
@objc(BeenbyGeofencePlugin)
public class BeenbyGeofencePlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "BeenbyGeofencePlugin"
    public let jsName = "BeenbyGeofence"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPermissionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestWhenInUsePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAlwaysPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startMonitoringRegion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopMonitoringRegion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getMonitoredRegions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getNotificationPermissionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotificationPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPendingConfirmations", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingConfirmation", returnType: CAPPluginReturnPromise)
    ]

    private let geofence = BeenbyGeofenceManager.shared
    private let arrivals = BeenbyArrivalNotifications.shared

    override public func load() {
        // Registers the BEENBY_ARRIVAL category and installs the notification
        // delegate (merging with any existing categories/delegate).
        arrivals.configure()
        arrivals.onConfirmed = { [weak self] payload in
            self?.notifyListeners("geofenceConfirmed", data: payload)
        }

        // Single delegate wiring for the shared, long-lived manager.
        geofence.onEnter = { [weak self] payload in
            self?.notifyListeners("geofenceEnter", data: payload)
        }
        geofence.onError = { [weak self] payload in
            self?.notifyListeners("geofenceError", data: payload)
        }
        geofence.onAuthorizationChange = { [weak self] status in
            self?.notifyListeners("geofencePermissionChange", data: ["status": status])
        }
    }

    // MARK: - Permissions

    @objc func getPermissionStatus(_ call: CAPPluginCall) {
        call.resolve([
            "status": geofence.authorizationStatusString,
            "monitoringAvailable": geofence.isMonitoringAvailable
        ])
    }

    @objc func requestWhenInUsePermission(_ call: CAPPluginCall) {
        geofence.requestWhenInUse()
        call.resolve(["status": geofence.authorizationStatusString])
    }

    @objc func requestAlwaysPermission(_ call: CAPPluginCall) {
        // iOS may only show the "Always" prompt once When In Use is granted;
        // the manager falls back to asking for When In Use first.
        geofence.requestAlways()
        call.resolve(["status": geofence.authorizationStatusString])
    }

    // MARK: - Region monitoring

    @objc func startMonitoringRegion(_ call: CAPPluginCall) {
        guard let identifier = call.getString("identifier"), !identifier.isEmpty else {
            call.reject("identifier is required")
            return
        }
        guard let latitude = call.getDouble("latitude"), let longitude = call.getDouble("longitude") else {
            call.reject("latitude and longitude are required")
            return
        }
        let radius = call.getDouble("radius") ?? 150

        // Persist non-secret region metadata so a background/terminated launch
        // can build the notification text without running any JS.
        if let parsed = BeenbyArrivalNotifications.shared.regionMeta(for: identifier) {
            arrivals.saveRegionMeta(identifier: identifier,
                                    familyCircleId: call.getString("familyCircleId") ?? parsed.familyCircleId,
                                    personId: call.getString("personId") ?? parsed.personId,
                                    personName: call.getString("personName") ?? parsed.personName)
        }

        switch geofence.startMonitoring(identifier: identifier,
                                        latitude: latitude,
                                        longitude: longitude,
                                        radius: radius) {
        case .success(let effectiveRadius):
            call.resolve([
                "started": true,
                "identifier": identifier,
                "radius": effectiveRadius
            ])
        case .failure(let message):
            // Never crash — report as an event and resolve with started: false.
            notifyListeners("geofenceError", data: ["identifier": identifier, "message": message])
            call.resolve([
                "started": false,
                "identifier": identifier,
                "message": message
            ])
        }
    }

    @objc func stopMonitoringRegion(_ call: CAPPluginCall) {
        guard let identifier = call.getString("identifier"), !identifier.isEmpty else {
            call.reject("identifier is required")
            return
        }
        let stopped = geofence.stopMonitoring(identifier: identifier)
        arrivals.removeRegionMeta(identifier: identifier)
        call.resolve(["stopped": stopped, "identifier": identifier])
    }

    @objc func getMonitoredRegions(_ call: CAPPluginCall) {
        call.resolve(["regions": geofence.monitoredRegions()])
    }

    // MARK: - Notifications

    @objc func getNotificationPermissionStatus(_ call: CAPPluginCall) {
        arrivals.getPermissionStatus { status in
            call.resolve(["status": status])
        }
    }

    @objc func requestNotificationPermission(_ call: CAPPluginCall) {
        arrivals.requestPermission { status, granted in
            call.resolve(["status": status, "granted": granted])
        }
    }

    @objc func getPendingConfirmations(_ call: CAPPluginCall) {
        call.resolve(["confirmations": arrivals.pendingConfirmations()])
    }

    @objc func clearPendingConfirmation(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else {
            call.reject("id is required")
            return
        }
        let cleared = arrivals.clearPendingConfirmation(id: id)
        call.resolve(["cleared": cleared])
    }
}
