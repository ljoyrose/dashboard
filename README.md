# Lisa Dashboard

A single-page, **read-only** Google Drive dashboard, served by GitHub Pages at
<https://ljoyrose.github.io/dashboard/>.

- Sign in with Google (Drive read-only scope only). Nothing is shown until you sign in.
- The access token is kept in memory only and is never saved in the browser or this repo.
- Shows recent changes and counts for the "Cf overskill" folder tree, the contents of
  "0 - AI (read first)", and the most recently modified files across Drive (including shared drives).
- Refreshes every 5 minutes while open.

The repo contains no secrets. The OAuth client ID in `index.html` is public by design and only
works from the authorised origin `https://ljoyrose.github.io`.
