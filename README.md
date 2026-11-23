# TTD Pilgrim Autofill

## Install in Chrome

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the repository folder (the one containing `manifest.json`).
5. Pin the extension from the puzzle-piece menu and open it to add your details.

## Install in Firefox (128 or newer)

### Temporary (removed when Firefox restarts)

1. Download or clone this repository.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `manifest.json` from the repository folder.

### Permanent

1. Build the Firefox package (requires Node.js and `zip`):
   ```sh
   node build.mjs
   ```
2. Sign it with a free addons.mozilla.org account ([API keys](https://addons.mozilla.org/developers/addon/api/key/)):
   ```sh
   npx web-ext sign --source-dir dist/firefox --channel=unlisted --api-key=<JWT issuer> --api-secret=<JWT secret>
   ```
3. Open `about:addons` → ⚙ → **Install Add-on From File…** and select the signed `.xpi` from `web-ext-artifacts/`.

### Allow site access

Open the extension popup and click **Allow access to TTD sites** if it is shown (or `about:addons` → the extension → **Permissions** → enable both TTD sites), then reload the TTD page.
