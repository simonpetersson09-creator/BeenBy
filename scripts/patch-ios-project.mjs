/**
 * Idempotently registers the generated <lang>.lproj/InfoPlist.strings files in
 * the Xcode project (ios/App/App.xcodeproj/project.pbxproj) so they end up in
 * the App target's "Copy Bundle Resources" phase automatically — no manual
 * drag-and-drop in Xcode after `npx cap sync ios`.
 *
 * What it does:
 *  1. Adds a PBXVariantGroup "InfoPlist.strings" with one child file reference
 *     per language (sv.lproj/InfoPlist.strings, de.lproj/... and so on).
 *  2. Adds the variant group to the App group and to the Resources build phase.
 *  3. Extends the project's knownRegions with all supported languages.
 *
 * Safe to run repeatedly. Run: node scripts/patch-ios-project.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";
const LANGS = ["en", "sv", "de", "da", "fi", "es", "fr"];

/** Stable, project-unique 24-hex ids (Xcode only needs uniqueness). */
const VARIANT_GROUP_ID = "BEE0B1000000000000000001";
const BUILD_FILE_ID = "BEE0B1000000000000000002";
const fileRefId = (lang) =>
  `BEE0B1${Buffer.from(lang).toString("hex").padEnd(10, "0").slice(0, 10)}0000000`.slice(0, 24);

if (!existsSync(PBXPROJ)) {
  console.error(`Hittar inte ${PBXPROJ}. Kör "npx cap add ios" först.`);
  process.exit(1);
}

let pbx = readFileSync(PBXPROJ, "utf8");
const changes = [];

/* ---------- 1. PBXFileReference entries ---------- */
const refLines = LANGS.map(
  (lang) =>
    `\t\t${fileRefId(lang)} /* ${lang} */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ${lang}; path = ${lang}.lproj/InfoPlist.strings; sourceTree = "<group>"; };`,
).filter((line) => !pbx.includes(line.trim().split(" ")[0]));

if (refLines.length) {
  pbx = pbx.replace(
    "/* End PBXFileReference section */",
    `${refLines.join("\n")}\n/* End PBXFileReference section */`,
  );
  changes.push("file references");
}

/* ---------- 2. PBXVariantGroup ---------- */
if (!pbx.includes(VARIANT_GROUP_ID)) {
  const children = LANGS.map((l) => `\t\t\t\t${fileRefId(l)} /* ${l} */,`).join("\n");
  const group = `\t\t${VARIANT_GROUP_ID} /* InfoPlist.strings */ = {\n\t\t\tisa = PBXVariantGroup;\n\t\t\tchildren = (\n${children}\n\t\t\t);\n\t\t\tname = InfoPlist.strings;\n\t\t\tsourceTree = "<group>";\n\t\t};`;

  if (pbx.includes("/* Begin PBXVariantGroup section */")) {
    pbx = pbx.replace(
      "/* End PBXVariantGroup section */",
      `${group}\n/* End PBXVariantGroup section */`,
    );
  } else {
    pbx = pbx.replace(
      "/* Begin XCBuildConfiguration section */",
      `/* Begin PBXVariantGroup section */\n${group}\n/* End PBXVariantGroup section */\n\n/* Begin XCBuildConfiguration section */`,
    );
  }
  changes.push("variant group");
}

/* ---------- 3. Add variant group to the App group ---------- */
if (!new RegExp(`${VARIANT_GROUP_ID} /\\* InfoPlist.strings \\*/,`).test(pbx)) {
  const appGroup = pbx.match(
    /([0-9A-F]{24}) \/\* App \*\/ = \{\s*\n\t{3}isa = PBXGroup;\s*\n\t{3}children = \(\n/,
  );
  if (!appGroup) {
    console.error("Hittade inte App-gruppen i project.pbxproj.");
    process.exit(1);
  }
  pbx = pbx.replace(
    appGroup[0],
    `${appGroup[0]}\t\t\t\t${VARIANT_GROUP_ID} /* InfoPlist.strings */,\n`,
  );
  changes.push("App group membership");
}

/* ---------- 4. PBXBuildFile + Resources build phase ---------- */
if (!pbx.includes(BUILD_FILE_ID)) {
  pbx = pbx.replace(
    "/* End PBXBuildFile section */",
    `\t\t${BUILD_FILE_ID} /* InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = ${VARIANT_GROUP_ID} /* InfoPlist.strings */; };\n/* End PBXBuildFile section */`,
  );

  const phase = pbx.match(/isa = PBXResourcesBuildPhase;[\s\S]*?files = \(\n/);
  if (!phase) {
    console.error("Hittade inte Resources build phase i project.pbxproj.");
    process.exit(1);
  }
  pbx = pbx.replace(
    phase[0],
    `${phase[0]}\t\t\t\t${BUILD_FILE_ID} /* InfoPlist.strings in Resources */,\n`,
  );
  changes.push("Copy Bundle Resources");
}

/* ---------- 5. knownRegions ---------- */
const regions = pbx.match(/knownRegions = \(\n([\s\S]*?)\t{3}\);/);
if (regions) {
  const missing = LANGS.filter((l) => !new RegExp(`\\b${l}\\b`).test(regions[1]));
  if (missing.length) {
    const added = missing.map((l) => `\t\t\t\t${l},`).join("\n");
    pbx = pbx.replace(regions[0], `knownRegions = (\n${added}\n${regions[1]}\t\t\t);`);
    changes.push(`knownRegions (${missing.join(", ")})`);
  }
}

writeFileSync(PBXPROJ, pbx);
console.log(
  changes.length
    ? `Xcode-projektet uppdaterat: ${changes.join(", ")}.`
    : "Xcode-projektet var redan uppdaterat.",
);
