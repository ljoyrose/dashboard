# build-site

Makes `_site/` for Cloudflare Pages with exactly the files GitHub Pages publishes (the `cp -r` line in
`.github/workflows/pages.yml`). Tests, docs, fixtures, tools and `.github` are never published.

Cloudflare Pages: Build command `sh tools/build-site/build.sh`, Build output directory `_site`.

Local check: `sh tools/build-site/build.sh && SITE_BASE=/ npx playwright test --project=mocked`
(the suite serves the repo at the root, as Cloudflare does).
