import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.izcad.viewer",
  appName: "izCAD",
  webDir: "dist",
  android: {
    minWebViewVersion: 64,
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
