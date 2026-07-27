import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const variablesPath = resolve("android", "variables.gradle");
const manifestPath = resolve(
  "android",
  "app",
  "src",
  "main",
  "AndroidManifest.xml",
);

const source = await readFile(variablesPath, "utf8");
const minimumAndroid8 = source.replace(
  /minSdkVersion\s*=\s*\d+/,
  "minSdkVersion = 26",
);

if (minimumAndroid8 === source && !/minSdkVersion\s*=\s*26/.test(source)) {
  throw new Error(
    "Could not set Android minSdkVersion. Check android/variables.gradle.",
  );
}

await writeFile(variablesPath, minimumAndroid8, "utf8");

const manifestSource = await readFile(manifestPath, "utf8");
const manifestWithoutNetworkAccess = manifestSource
  .replace(
    /\s*<uses-permission\s+android:name="android\.permission\.INTERNET"\s*\/>\s*/g,
    "\n",
  )
  .replace(
    /\s+android:usesCleartextTraffic="(?:true|false)"/g,
    "",
  );
const offlineManifest = manifestWithoutNetworkAccess.replace(
  /<application\b/,
  '<application android:usesCleartextTraffic="false"',
);

if (/android\.permission\.INTERNET/.test(offlineManifest)) {
  throw new Error(
    "Could not remove Android internet permission from AndroidManifest.xml.",
  );
}

if (!/android:usesCleartextTraffic="false"/.test(offlineManifest)) {
  throw new Error(
    "Could not disable cleartext traffic in AndroidManifest.xml.",
  );
}

await writeFile(manifestPath, offlineManifest, "utf8");

console.log(
  "Android is configured for API 26+ with network access disabled.",
);
