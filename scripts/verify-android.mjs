import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const checks = [];

function check(name, passed, detail) {
  checks.push({ name, passed, detail });
}

async function exists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

const variablesPath = resolve("android", "variables.gradle");
const manifestPath = resolve(
  "android",
  "app",
  "src",
  "main",
  "AndroidManifest.xml",
);
const stringsPath = resolve(
  "android",
  "app",
  "src",
  "main",
  "res",
  "values",
  "strings.xml",
);
const mainActivityPath = resolve(
  "android",
  "app",
  "src",
  "main",
  "java",
  "com",
  "izcad",
  "viewer",
  "MainActivity.java",
);
const incomingDrawingPluginPath = resolve(
  "android",
  "app",
  "src",
  "main",
  "java",
  "com",
  "izcad",
  "viewer",
  "IncomingDrawingPlugin.java",
);
const webIndexPath = resolve(
  "android",
  "app",
  "src",
  "main",
  "assets",
  "public",
  "index.html",
);
const libreDwgJsPath = resolve(
  "public",
  "wasm",
  "libredwg-web.js",
);
const libreDwgWasmPath = resolve(
  "public",
  "wasm",
  "libredwg-web.wasm",
);
const drawingFontPath = resolve(
  "public",
  "fonts",
  "IzCadSans-Regular.ttf",
);
const androidWebRoot = resolve(
  "android",
  "app",
  "src",
  "main",
  "assets",
  "public",
);
const requiredPackagedNotices = [
  "LICENSE",
  "LICENSE-APACHE-2.0.txt",
  "LICENSE-MPL-2.0.txt",
  "NOTICE.md",
  "THIRD_PARTY_LICENSES.md",
];

const [variables, manifest, strings, mainActivity, incomingDrawingPlugin] =
  await Promise.all([
    readFile(variablesPath, "utf8"),
    readFile(manifestPath, "utf8"),
    readFile(stringsPath, "utf8"),
    readFile(mainActivityPath, "utf8"),
    readFile(incomingDrawingPluginPath, "utf8"),
  ]);

check(
  "Minimum Android version",
  /minSdkVersion\s*=\s*26\b/.test(variables),
  "API 26 (Android 8) is required.",
);
check(
  "Application name",
  /<string name="app_name">izCAD<\/string>/.test(strings),
  'Android launcher name must be "izCAD".',
);
check(
  "No Android internet permission",
  !/android\.permission\.INTERNET/.test(manifest),
  "The offline application must not request INTERNET permission.",
);
check(
  "Cleartext traffic disabled",
  /android:usesCleartextTraffic="false"/.test(manifest),
  "Android cleartext traffic must remain disabled.",
);
check(
  "Android Open with support",
  /android\.intent\.action\.VIEW/.test(manifest) &&
    /android\.intent\.category\.DEFAULT/.test(manifest) &&
    /android:mimeType="image\/vnd\.dwg"/.test(manifest) &&
    /android:mimeType="application\/dxf"/.test(manifest),
  "The main activity must advertise DXF and DWG ACTION_VIEW support.",
);
check(
  "Incoming drawing bridge",
  /registerPlugin\(IncomingDrawingPlugin\.class\)/.test(mainActivity) &&
    /@CapacitorPlugin\(name\s*=\s*"IncomingDrawing"\)/.test(
      incomingDrawingPlugin,
    ) &&
    /handleOnNewIntent\(Intent intent\)/.test(incomingDrawingPlugin),
  "The native bridge must pass Android file intents to the web application.",
);
check(
  "Synced web application",
  await exists(webIndexPath),
  "Run npm run android:sync after changing web code.",
);
check(
  "Offline drawing font",
  await exists(drawingFontPath),
  "The local TTF font is required for DXF TEXT and MTEXT entities.",
);
check(
  "LibreDWG JavaScript runtime",
  await exists(libreDwgJsPath),
  "Run npm run build to copy the pinned DWG runtime.",
);
check(
  "LibreDWG WebAssembly runtime",
  await exists(libreDwgWasmPath),
  "Run npm run build to copy the pinned DWG runtime.",
);
check(
  "Android DWG runtime",
  await Promise.all([
    "libredwg-web.js",
    "libredwg-web.wasm",
  ]).then((results) =>
    Promise.all(
      results.map((fileName) =>
        exists(resolve(androidWebRoot, "wasm", fileName)),
      ),
    ),
  ).then((results) => results.every(Boolean)),
  "Run npm run android:sync to copy the offline converter.",
);
check(
  "Android drawing font",
  await exists(
    resolve(
      androidWebRoot,
      "fonts",
      "IzCadSans-Regular.ttf",
    ),
  ),
  "Run npm run android:sync to copy the offline drawing font.",
);
check(
  "Android open-source notices",
  await Promise.all(
    requiredPackagedNotices.map((fileName) =>
      exists(resolve(androidWebRoot, "licenses", fileName)),
    ),
  ).then((results) => results.every(Boolean)),
  "Run npm run android:sync to package the required license notices.",
);

for (const result of checks) {
  console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.name}`);
  if (!result.passed) {
    console.log(`      ${result.detail}`);
  }
}

if (checks.some((result) => !result.passed)) {
  process.exitCode = 1;
} else {
  console.log("Android source project checks passed.");
}
