/**
 * Builds a signed Android App Bundle (.aab) for Google Play.
 * Requires android/keystore.properties (see android/app/build.gradle) and a
 * JDK 21 + Android SDK (Android Studio installs both).
 *
 * Output: android/app/build/outputs/bundle/release/app-release.aab
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync("android/keystore.properties")) {
  console.error("[android:bundle] android/keystore.properties missing — the bundle would be unsigned.");
  process.exit(1);
}
const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
execSync(`${gradlew} bundleRelease`, { cwd: "android", stdio: "inherit" });
console.log("\n[android:bundle] Done: android/app/build/outputs/bundle/release/app-release.aab");
