import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

const libDxfrwPackageDirectory = resolve(
  "node_modules",
  "@mlightcad",
  "libdxfrw-web",
);
const libDxfrwMetadata = JSON.parse(
  await readFile(
    resolve(libDxfrwPackageDirectory, "package.json"),
    "utf8",
  ),
);

if (libDxfrwMetadata.version !== "0.1.0") {
  throw new Error(
    `Expected @mlightcad/libdxfrw-web 0.1.0, found ${libDxfrwMetadata.version}.`,
  );
}

const destinationDirectory = resolve("public", "wasm");
await mkdir(destinationDirectory, { recursive: true });

await Promise.all([
  copyFile(
    resolve(
      libDxfrwPackageDirectory,
      "dist",
      "libdxfrw.wasm",
    ),
    resolve(destinationDirectory, "libdxfrw.wasm"),
  ),
]);

const libDxfrwSource = await readFile(
  resolve(libDxfrwPackageDirectory, "dist", "libdxfrw.js"),
  "utf8",
);
await writeFile(
  resolve(destinationDirectory, "libdxfrw-web.js"),
  `${libDxfrwSource}\nexport default createModule;\n`,
  "utf8",
);

const licenseDestinationDirectory = resolve("public", "licenses");
await mkdir(licenseDestinationDirectory, { recursive: true });

const distributableLicenseFiles = [
  "LICENSE",
  "LICENSE-APACHE-2.0.txt",
  "LICENSE-CAPACITOR-MIT.txt",
  "LICENSE-DXF-PARSER-MIT.txt",
  "LICENSE-FONT-OFL-1.1.txt",
  "LICENSE-MPL-2.0.txt",
  "LICENSE-REACT-MIT.txt",
  "LICENSE-THREE-MIT.txt",
  "NOTICE.md",
  "THIRD_PARTY_LICENSES.md",
];

await Promise.all(
  distributableLicenseFiles.map((fileName) =>
    copyFile(
      resolve(fileName),
      resolve(licenseDestinationDirectory, fileName),
    ),
  ),
);

console.log(
  "Offline libdxfrw runtime and open-source notices copied to public assets.",
);
