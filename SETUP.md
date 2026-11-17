# mydinner2: Secrets and Setup

No API keys live in this repo. The app reads them from `config.js`, which is gitignored.

## Secrets inventory

| Key in config.js | Purpose | How to get it |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Maps JavaScript API + Places (restaurant search) | Google Cloud Console > APIs & Services > Credentials |

## Setup

1. `cp config.example.js config.js`
2. Paste your key(s) into `config.js`.
3. In Google Cloud Console > Credentials, restrict each key:
   - **Application restrictions:** Websites > your site URL(s) (plus `http://localhost:*` for testing)
   - **API restrictions:** only the APIs listed above
   - Add a billing budget alert on the project
4. Serve the folder (for example the VS Code Live Server extension or `npx serve .`).

> **GitHub Pages note:** because `config.js` is not committed, a Pages deploy from the branch will load without maps. To publish with a key, either commit a **referrer-restricted** key in `config.js` on purpose (browser Maps keys are visible to visitors anyway) or copy the `pages.yml` workflow pattern from the brightservices repo, which generates `config.js` from a repo secret.

## Rotation log

Keys previously committed to this repo are in git history and should be treated as public.

| Date | Secret | Action |
|---|---|---|
| 2026-11-16 | Google Maps key (`AIza...9QfI`) | Removed from code. **Same key is used on brightfuturetechllc.com.** Delete it and issue new restricted keys, one per site. |
