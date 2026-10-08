# Lisa Dashboard

A single-page, **read-only** Google Drive surface, served by GitHub Pages at
<https://ljoyrose.github.io/dashboard/>. It reads Drive live each time it opens. Nothing is baked in.

- **Sections** (one shared header, Map first): Map, Read first, Drive, Changes (Recent, Last 24h, Last 7 days, Totals).
  The section is in the URL (`#/changes/24h`), so back, reload and links all work. Browser storage is not used.
- **Sign-in:** Google, Drive read-only scope only. The access token is kept in memory and never saved.
- **Every panel** shows where it read from and when it was read (UK time). It also shows whether the read
  is pending, failed, empty or capped.
- **Look:** Lexend only, LJR7 palette (slot 0 for Read first and Drive, slot 7 for Cf overskill), light and dark modes.
- **Writes:** none.

The repo contains no secrets. The OAuth client ID in `index.html` is public by design and only works from the
authorised origin `https://ljoyrose.github.io`.

## CD Hub (`/cdhub/`)

<https://ljoyrose.github.io/dashboard/cdhub/> is a read-only web copy of the CurlyCwtch Cobberdog Hub.
After Google sign-in (same OAuth client, Drive read-only scope) it lists the `BLD-app-tables` folder and reads
the `BLD-*.csv` tables live. No data is in the repo, nothing is kept in the browser, and saving (the round,
cabin access, flags) is switched off for now.
