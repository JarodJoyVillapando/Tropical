# Tropical — Shopify Theme

A Shopify Online Store 2.0 theme built for demo and local development. Build and preview modules now; connect to a Shopify store when you're ready to deploy.

## Quick start

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:9292](http://127.0.0.1:9292) for the homepage preview, or [http://127.0.0.1:9292/sections](http://127.0.0.1:9292/sections) to browse individual sections.

Changes to Liquid, assets, templates, and mock data reload automatically.

## Project structure

```
├── assets/          CSS, JS, images (served at /assets)
├── config/          Theme settings (settings_schema.json, settings_data.json)
├── layout/          theme.liquid wrapper
├── locales/         Translation strings
├── sections/        Homepage modules & reusable sections
├── snippets/        Partial templates
├── templates/       JSON templates (index.json = homepage)
└── dev/
    ├── server.mjs       Local preview server
    ├── liquid-engine.mjs  Liquid renderer with Shopify-like tags/filters
    └── mocks/           Sample shop, product, and collection data
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Local preview server (no Shopify account needed) |
| `npm run theme:check` | Lint theme with Shopify Theme Check |
| `npm run theme:dev` | Connect to a Shopify store for full preview (requires account) |
| `npm run theme:push` | Push theme to a connected store |

## Local preview vs. Shopify

The local dev server renders Liquid templates with mock data from `dev/mocks/`. It supports:

- JSON templates and section rendering
- `{% render %}` snippets
- Common filters (`asset_url`, `stylesheet_tag`, `money`, etc.)
- `{% stylesheet %}` blocks (converted to inline `<style>`)

When you connect a Shopify store, `npm run theme:dev` gives you real product data, the theme editor, and checkout preview.

## Connecting Shopify later

1. Create a [Shopify development store](https://help.shopify.com/en/partners/dashboard/managing-stores/development-stores)
2. Install [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) (included as a dev dependency)
3. Run `npm run theme:dev` and follow the login prompts
4. Push to production with `npm run theme:push`

## Adding homepage modules

1. Create a new section in `sections/your-module.liquid` with a `{% schema %}` block
2. Register it in `templates/index.json` under `sections` and `order`
3. Preview at `/sections/your-module` or on the homepage

Mock product/collection data lives in `dev/mocks/` — edit these to test different content locally.
