/**
 * Idempotently gives the iOS app its Push Notifications capability, so nobody
 * has to remember to tick the box in Xcode after `npx cap add ios` /
 * `npx cap sync ios`.
 *
 * What it does:
 *  1. Creates ios/App/App/App.entitlements with `aps-environment`
 *     (production — TestFlight and the App Store both use production APNs;
 *     a development build automatically falls back to the sandbox).
 *  2. Registers the file in the Xcode project and sets
 *     CODE_SIGN_ENTITLEMENTS for every build configuration.
 *
 * Safe to run repeatedly. Run: node scripts/patch-ios-capabilities.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const APP_DIR = "ios/App/App";
const ENTITLEMENTS = `${APP_DIR}/App.entitlements`;
const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";
const FILE_REF_ID = "BEE0C1000000000000000001";

const changes = [];

/* ---------- 1. entitlements file ---------- */
const ENTITLEMENTS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>production</string>
</dict>
</plist>
`;

if (!existsSync(APP_DIR)) {
  console.error(`Hittar inte ${APP_DIR}. Kör "npx cap add ios" först.`);
  process.exit(1);
}

if (!existsSync(ENTITLEMENTS)) {
  writeFileSync(ENTITLEMENTS, ENTITLEMENTS_XML, "utf8");
  changes.push("App.entitlements");
} else if (!readFileSync(ENTITLEMENTS, "utf8").includes("aps-environment")) {
  const current = readFileSync(ENTITLEMENTS, "utf8").replace(
    /<dict>/,
    "<dict>\n\t<key>aps-environment</key>\n\t<string>production</string>",
  );
  writeFileSync(ENTITLEMENTS, current, "utf8");
  changes.push("aps-environment");
}

/* ---------- 2. Xcode project ---------- */
if (!existsSync(PBXPROJ)) {
  console.error(`Hittar inte ${PBXPROJ}. Kör "npx cap add ios" först.`);
  process.exit(1);
}

let pbx = readFileSync(PBXPROJ, "utf8");

if (!pbx.includes(FILE_REF_ID)) {
  pbx = pbx.replace(
    "/* End PBXFileReference section */",
    `\t\t${FILE_REF_ID} /* App.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = App.entitlements; sourceTree = "<group>"; };\n/* End PBXFileReference section */`,
  );
  // Put it next to Info.plist in the App group so it is visible in Xcode.
  pbx = pbx.replace(
    /(\w{24} \/\* Info\.plist \*\/,\n)/,
    `$1\t\t\t\t${FILE_REF_ID} /* App.entitlements */,\n`,
  );
  changes.push("file reference");
}

if (!pbx.includes("CODE_SIGN_ENTITLEMENTS")) {
  pbx = pbx.replace(
    /(\t{4})PRODUCT_BUNDLE_IDENTIFIER = /g,
    `$1CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n$1PRODUCT_BUNDLE_IDENTIFIER = `,
  );
  changes.push("CODE_SIGN_ENTITLEMENTS");
}

writeFileSync(PBXPROJ, pbx);
console.log(
  changes.length
    ? `Push-capability på plats: ${changes.join(", ")}.`
    : "Push-capability var redan på plats.",
);
