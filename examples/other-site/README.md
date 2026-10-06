# Example app: other-site

English | [한국어](README.ko.md)

A minimal Next app that attaches `@monti-cms/core` with collections (Article, Topic, Author), fields and a language (English) that differ from the main blog's. From the blocks extension (`@monti-cms/blocks`) it
installs only the chart and adds site blocks (`quote-card` and the `map` code fence). The SEO fields come from `seoFields` in the SEO extension (`@monti-cms/seo`),
added with different names and a `Search` tab. Packages are installed from **built bundles** (`vendor/*.tgz`), not from the repository sources.

```sh
# From the repo root: build the packages and pack them into vendor/
pnpm example:pack

# In this folder
pnpm install --ignore-workspace
cp .env.example .env.local   # fill in CMS_DATABASE_URL and the rest
pnpm db:migrate               # = monti migrate
pnpm dev                     # http://localhost:3000/studio
```

pnpm 12 stops the install unless the esbuild install script is allowed. Copy this folder out of the repo, put `allowBuilds: { esbuild: true }` in `pnpm-workspace.yaml`, and install with `pnpm install` (with `--ignore-workspace` that setting is not read). pnpm 10, which the repo uses, only warns.

With `CMS_DEV_AUTH_BYPASS=1`, `next dev` opens the admin screen without logging in for requests from your own machine (`localhost`). The bypass is refused on a server that looks deployed. Deploying behind a proxy or on Vercel needs `AUTH_TRUST_HOST=true` for login (core README, "Host trust").

## Files

The shape is what `monti init --admin-path /studio` generates, plus this site's collections and extensions.

| File | Contents |
| --- | --- |
| `cms.config.ts` | Collections, blocks and extensions. Unlike the blog: admin path `admin.path: "/studio"`, URL rule `site.localePrefix: "always"` (`/en` for every language), and the preview language comes from the path (`previewLocaleParam: false`) |
| `cms.server.ts` | The CMS instance: `createCms` over the DB and GitHub login server config (as `monti init` generates). The admin, the API route and the site pages (`cms.read.*`) all import `cms` from it |
| `app/components/site-blocks.tsx` | Public components of the site blocks (`quote-card`, `map`), typed from the block definitions through `DocumentComponents` and passed to `<CmsContent components={...} />` |
| `app/(admin)/studio/` | The admin screen (`[[...path]]/page.tsx` and `layout.tsx`) and an example spell-check extension (`admin-components.tsx`) |
| `app/api/cms/[...path]/route.ts` | Admin API and login (`/api/cms/auth/*`). There is no separate login route file |
| `app/globals.css` | Only the Tailwind and package style imports. Admin colors and variants (`cms-*`, `cms-dark`, and so on) are defined by the admin package styles and do not collide with the app's names |

To use GitHub login, set the OAuth app's callback URL to `http://localhost:3000/api/cms/auth/callback/github`.

## Trying it inside the repo

This does not use the production DB. It creates a `cms_preview_*` schema in the test DB (`CMS_TEST_DATABASE_URL`) and drops it when finished.

```sh
export CMS_DATABASE_URL="$CMS_TEST_DATABASE_URL" CMS_SCHEMA=cms_preview_example CMS_DEV_AUTH_BYPASS=1 AUTH_SECRET=local-only
# (after creating the schema cms_preview_example)
pnpm exec monti migrate --no-env-file
pnpm exec next dev -p 3997   # http://localhost:3997/studio
```

Do not commit the `AGENTS.md` and `CLAUDE.md` that `next dev` creates in this folder.
