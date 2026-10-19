import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "README.md",
  "LICENSE",
  "manifest.json",
  "versions.json",
  "main.js",
  "styles.css",
  "docs/privacy-and-network.md",
  "docs/release-checklist.md",
];
for (const file of requiredFiles) {
  await access(file);
}

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));

const errors = [];
const bundle = await readFile("main.js", "utf8");
for (const name of [
  "react",
  "date-fns",
  "easy-obookshelf",
  "link-card-preview",
  "selection-format-toolbar",
]) {
  const license = await readFile(`third_party/${name}/LICENSE`, "utf8");
  if (!bundle.includes(license)) {
    errors.push(`main.js is missing the ${name} license`);
  }
}
if (manifest.id !== "seiton") {
  errors.push("manifest id must be seiton");
}
if (manifest.version !== packageJson.version) {
  errors.push("manifest and package versions differ");
}
if (versions[manifest.version] !== manifest.minAppVersion) {
  errors.push("versions.json does not match manifest");
}
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  errors.push("manifest version is not SemVer");
}
if (manifest.description.length > 250) {
  errors.push("manifest description exceeds 250 characters");
}
if (manifest.isDesktopOnly !== false) {
  errors.push("Seiton must remain mobile-installable");
}

if (errors.length) {
  for (const error of errors) {
    console.error(`release check: ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `release check: ${manifest.id} ${manifest.version} assets and metadata are consistent`
  );
}
