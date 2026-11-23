#!/usr/bin/env node
// Packages the extension for each browser from the single shared source tree.
//   node build.mjs            → dist/ttd-autofill-chrome.zip, dist/ttd-autofill-firefox.xpi
// Each package gets a manifest without the other browser's keys (avoids "unrecognized key" warnings).
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const SOURCES = ["manifest.json", "content", "popup", "icons"];

const targets = {
  chrome: { file: "ttd-autofill-chrome.zip", strip: ["browser_specific_settings"] },
  firefox: { file: "ttd-autofill-firefox.xpi", strip: ["minimum_chrome_version"] },
};

rmSync(dist, { recursive: true, force: true });
for (const [name, { file, strip }] of Object.entries(targets)) {
  const stage = join(dist, name);
  mkdirSync(stage, { recursive: true });
  for (const s of SOURCES) cpSync(join(root, s), join(stage, s), { recursive: true });
  const m = { ...manifest };
  for (const k of strip) delete m[k];
  writeFileSync(join(stage, "manifest.json"), JSON.stringify(m, null, 2) + "\n");
  execFileSync("zip", ["-qr", join(dist, file), "."], { cwd: stage });
  console.log(`${name}: dist/${file}  (unpacked: dist/${name}/)`);
}
