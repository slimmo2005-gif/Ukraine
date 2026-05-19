# Bundled territory data

JSON snapshots are mirrored here by `npm run sync-data` (or CI) from
[ukraine-territory-data](https://github.com/slimmo2005-gif/ukraine-territory-data).

The dashboard loads these files from the **same origin** as the app so corporate
firewalls that block `raw.githubusercontent.com` still work on GitHub Pages.

Do not edit files by hand. Re-run sync via GitHub Actions:
**Sync territory data and deploy** workflow.
