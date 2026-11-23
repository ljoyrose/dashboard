# Host prototype A2: Cloudflare Pages behind Cloudflare Access

Status: NOTES ONLY. No Cloudflare setting was touched. The Pages project already exists and already builds a preview
for every pull request (`tools/build-site/build.sh`, the same files as the GitHub Pages publish).

## Checked on 20 Nov 2026 (Cloudflare's own documents)
- Free plan: 500 builds a month, one at a time. This repo merges about 650 times a month and builds a preview for
  every pull-request push on top, so builds must be cut down before relying on it (see step 2).
- The one-click "access policy" in the Pages project protects PREVIEW addresses only. The production `*.pages.dev`
  address and any custom domain stay open until an Access application is made for them. Cloudflare lists the steps
  under "Known issues": switch the policy on, edit the Access application it creates to remove the wildcard so the
  main address is covered, switch the policy on again for previews, and add a separate application for a custom domain.
- Access is free for up to 50 people. It can let people in by Google sign-in or by a one-time code sent to their email,
  so staff do not need Google accounts. NOT re-checked this time: the 50-person figure and the one-time code.
- NOT checked: leaving chosen paths open (a "bypass" rule per path) on a pages.dev address.

## What that means for this site
- Sign-in twice on a new device: Access's wall, then the dashboard's own Google sign-in for Drive.
- Pages for people with no Google sign-in (`marketplace/privacy.html`, `cdhub/staff/guest/`,
  `cdhub/staff/inspect/`, staff-code use of `cdhub/staff/` and `cdhub/checks/`) need either an open-path rule or a
  one-time-code rule. This must be proved on a preview before any switch.
- Preview addresses are public today. Each pull request's preview serves `config.js`, so previews carry the same ids as
  the live site. Switching the preview policy on closes that at once and changes nothing for the live site.
- The phone app (manifest and service worker) needs `crossorigin="use-credentials"` on the manifest link behind any
  login wall. Not changed here; test on a protected preview.
- A private GitHub repo still builds on Cloudflare Pages (the Cloudflare GitHub app keeps its access).

## Lisa's steps if A2 is chosen (bots give click-by-click notes for each)
1. Cloudflare > Workers & Pages > the dashboard project > Settings > General > switch on "Access policy". Previews are
   now behind a login. Safe today, undoable, nothing changes on the live site.
2. Same project > Settings > Builds: limit automatic builds to the `main` branch (previews by hand only), so the 500
   builds a month are not used up.
3. Zero Trust > Access > Applications: follow Cloudflare's "Known issues" steps so the main pages.dev address is
   covered. Add your Google account, then staff.
4. Decide the outsider pages (decision 5 in the decision pack) and add the rule for them. Test each one signed out.
5. Google Cloud console > APIs and services > Credentials > the dashboard's sign-in client: add the pages.dev address
   under "Authorised JavaScript origins".
6. Open the new address on phone and computer, sign in, check each hub. Then carry on with the decision pack's steps
   (links, QR cards, the stub at the old address, and only then the private switch).

## Sources
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Pages known issues (Access on the main address): https://developers.cloudflare.com/pages/platform/known-issues/
- Cloudflare Pages preview deployments: https://developers.cloudflare.com/pages/configuration/preview-deployments/
- Cloud Run with IAP (for comparison): https://docs.cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run
