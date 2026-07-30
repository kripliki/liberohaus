# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Liberohaus.cz — the marketing site for a Czech turnkey brick-house builder. It is plain static HTML (Czech-language content) with **one Jekyll collection** wired in purely so the house catalog can be edited through a CMS instead of hand-editing HTML. There is no JS framework, no bundler, and no package.json — the whole site is hand-authored HTML/CSS.

## Commands

There is no build/lint/test tooling in this repo (no package.json, no Gemfile). To preview locally you need Jekyll available on the host (GitHub Pages builds it server-side; no Gemfile is committed here, so use whatever `github-pages`-compatible Jekyll you have installed):

```bash
jekyll serve   # or: bundle exec jekyll serve, if you have a local Gemfile/bundler set up
```

There's nothing to `npm install` — the `netlify/functions/*.js` files run on Netlify's Node runtime as-is (no dependencies, no build step). `netlify.toml`'s build command is `true` (a deliberate no-op — see below).

## Architecture

**Two separate deployments, one repo:**

1. **GitHub Pages** serves the actual public site. It builds this repo with Jekyll (via `_config.yml`), rendering the static `.html` pages and the `_houses/` collection.
2. **A Netlify site** (`netlify.toml`) exists *only* to host the GitHub OAuth handshake (`netlify/functions/auth.js` + `callback.js`) for the Decap CMS admin. It intentionally does not build/serve the Jekyll site — `netlify/public/` is a placeholder page, and the build command is `true` so Netlify's dashboard-configured "jekyll build" (there is no Gemfile, so a real Jekyll build would fail) never runs.

**Content model:** only the house catalog (`katalog-domu.html`) is data-driven. Each house is a Markdown file with YAML front matter in `_houses/` (fields: `order`, `title`, `tagline`, `image`, `image_alt`, `dispozice`, `zastavena_plocha`, `podlahova_plocha`, `cta_text`, `cta_url`). `katalog-domu.html` has empty `---\n---` front matter (required to make Jekyll process the Liquid in the file) and loops over `site.houses | sort: "order"` to render the grid. `_config.yml` sets `collections.houses.output: false` so individual house Markdown files don't get their own generated pages — they only feed the loop.

  Every other `.html` page (`index.html`, `kontakt.html`, `realizace.html`, etc.) is fully static — no front matter, no Liquid — and is edited by hand.

**Decap CMS admin (`/admin`):** `admin/index.html` just loads the Decap CMS bundle from unpkg; `admin/config.yml` configures the `github` backend pointed at `kripliki/liberohaus` (branch `main`) with one collection, `house-grid`, mapped onto the `_houses/` folder using the fields above. Editing a house in `/admin` commits a Markdown file straight to `main` via the GitHub API — there's no build/preview step in the CMS flow itself.

**Auth flow for `/admin`:** Decap's `github` backend needs an OAuth proxy, which is what the two Netlify functions provide:
- `auth.js`: redirects to GitHub's OAuth authorize URL. Signs a `nonce.timestamp.hmac` state string with `GITHUB_CLIENT_SECRET` instead of using a cookie, because cookies set right before the GitHub redirect bounce are unreliable across browsers.
- `callback.js`: verifies that signed state (constant-time compare, 10-minute expiry), exchanges the code for a GitHub access token, and `postMessage`s it back to the Decap popup window that opened it. Sets `Cross-Origin-Opener-Policy: unsafe-none` explicitly so a stricter COOP from an intermediary doesn't sever `window.opener` before the message can be posted.
- Requires `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` env vars on the Netlify site (a GitHub OAuth App whose callback URL is that Netlify site's `/callback`).
- `admin/config.yml`'s `base_url` must point at wherever these functions are actually deployed — check it's current before assuming the OAuth flow works.

**Design system:** `css/style.css` is a single hand-written stylesheet built around CSS custom properties (charcoal/paper/brick palette, Fraunces + Work Sans + IBM Plex Mono type) — see the file header comment for the full token list. There's no CSS build step (no Sass/PostCSS); it's authored as final CSS.

**`liberohaus-content-map.md`** is a human-reference document paraphrasing every page's content/copy (not code) — useful for understanding what content exists on the live site without opening every HTML file, but not something to keep in sync mechanically.
