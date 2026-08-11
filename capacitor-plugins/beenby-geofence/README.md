# beenby-geofence

Local Capacitor plugin (iOS only) that exposes Core Location **region monitoring**
to JavaScript.

JS name: `BeenbyGeofence` → `registerPlugin("BeenbyGeofence")` in `src/lib/geofence.ts`.

Methods: `getPermissionStatus`, `requestWhenInUsePermission`,
`requestAlwaysPermission`, `startMonitoringRegion`, `stopMonitoringRegion`,
`getMonitoredRegions`.

Events: `geofenceEnter`, `geofenceError`, `geofencePermissionChange`.

Not included (by design, later steps): local notifications, Yes/No actions,
automatic visit registration, Premium gating, continuous location updates,
`allowsBackgroundLocationUpdates`.

Info.plist keys are provided by the app target
(`NSLocationWhenInUseUsageDescription`,
`NSLocationAlwaysAndWhenInUseUsageDescription`) — the plugin adds none.
