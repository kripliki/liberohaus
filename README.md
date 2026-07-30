# Liberohaus

Static marketing website for **Liberohaus s.r.o.**, a Czech company that designs and builds turnkey brick family houses (Ostrava · Praha · Brno) since 1995. The site presents the house catalog, completed projects, customer testimonials, company info, and an inquiry form, and lets a non-technical editor update the house catalog through a browser-based admin panel without touching code.

## Tech stack

- **Plain static HTML/CSS** — no JS framework, no bundler, no `package.json`. Each page (`index.html`, `kontakt.html`, `realizace.html`, `katalog-domu.html`, …) is hand-authored HTML, styled by a single stylesheet (`css/style.css`).
- **Jekyll**, used only for one data-driven piece: the house catalog. GitHub Pages builds the repo with Jekyll automatically (`_config.yml`), no local Gemfile required.
- **Decap CMS** (`/admin`), a git-backed content editor, for editing the house catalog through a form-based UI instead of hand-editing Markdown files.
- **Netlify Functions**, used solely to provide the GitHub OAuth handshake that Decap CMS's `github` backend needs.

## How the site is deployed

The repo powers **two separate deployments**:

1. **GitHub Pages** — serves the actual public website at the configured Pages URL, built by Jekyll from this repo.
2. **A Netlify site** — exists *only* to host the two OAuth functions below (`netlify/functions/`). It does **not** serve the real site; `netlify.toml` publishes a placeholder folder (`netlify/public/`) and sets the build command to a no-op (`true`), since there's no Gemfile for Netlify to build the Jekyll site with anyway.

## Dynamic content: the house catalog

Everything on the site is static hand-written HTML **except** the "Katalog domů" grid (`katalog-domu.html`), which is generated from data so it can be edited without touching HTML:

- Each house lives as a Markdown file with YAML front matter under `_houses/` (e.g. `_houses/libero.md`): order, title, tagline, photo, floor plan (`dispozice`), built-up/floor area, and CTA button text/link.
- `katalog-domu.html` carries empty `---\n---` front matter (so Jekyll processes Liquid in it) and loops over `site.houses | sort: "order"` to render one card per house.
- `_config.yml` marks the `houses` collection `output: false`, since each house is only ever rendered *inside* the catalog grid — it doesn't need its own standalone page.

## Editing content via Decap CMS + Netlify (GitHub) authentication

The `/admin` folder is a [Decap CMS](https://decapcms.org/) instance (`admin/index.html` loads the Decap bundle; `admin/config.yml` is its configuration). It's configured with the `github` backend (`admin/config.yml`), which means Decap commits changes directly to the `main` branch of `kripliki/liberohaus` via the GitHub API — there's no separate build/preview step in the CMS itself; a save is a real commit.

Because the `github` backend needs an OAuth token to act on the editor's behalf, and GitHub Pages can't run server-side code, the OAuth exchange is handled by a small Netlify site with two functions:

1. **`netlify/functions/auth.js`** — when an editor clicks "Login with GitHub" in `/admin`, this redirects them to GitHub's OAuth authorize page. Instead of a cookie, it signs a `nonce.timestamp.hmac` state value with `GITHUB_CLIENT_SECRET`, since cookies set immediately before a cross-site redirect bounce (to GitHub and back) aren't reliably preserved across browsers.
2. **`netlify/functions/callback.js`** — GitHub redirects back here with an authorization code. This function verifies the signed state (constant-time comparison, 10-minute expiry), exchanges the code for a GitHub access token, and posts that token back to the Decap popup window via `window.opener.postMessage(...)`, completing the login.

Configuration required for this to work:
- The Netlify site needs `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` environment variables, from a GitHub OAuth App whose authorization callback URL points at that Netlify site's `/callback` route.
- `admin/config.yml`'s `backend.base_url` must point at that same deployed Netlify site.

In short: **GitHub Pages hosts the site and the CMS UI, GitHub itself stores the content (as Markdown commits), and Netlify's only job is brokering the GitHub login so the CMS can write those commits on the editor's behalf.**

## Repository layout

```
_houses/            One Markdown file per house (feeds the katalog-domu.html grid)
_config.yml          Jekyll config (site title, houses collection settings)
admin/               Decap CMS admin UI + its config (backend, collections, fields)
netlify/functions/    GitHub OAuth handshake (auth.js, callback.js) for Decap CMS login
netlify/public/       Placeholder page published by the Netlify site (not the real site)
netlify.toml          Netlify build config (no-op build, publishes the placeholder, wires up the OAuth redirects)
css/style.css         Site-wide stylesheet (design tokens, single hand-written file)
*.html               Static pages (home, contact, projects, testimonials, etc.)
liberohaus-content-map.md   Human-readable summary of every page's content/copy
```
