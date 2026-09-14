import fs from 'node:fs/promises';
import path from 'node:path';
import { Liquid, Tag, Hash, toPromise } from 'liquidjs';
import { expandSettings, modifyFont, resolveFont, GOOGLE_FONTS_STYLESHEET } from './fonts.mjs';

const THEME_ROOT = path.resolve(import.meta.dirname, '..');

function stripShopifyBlocks(source) {
  return source
    .replace(/\{%-?\s*stylesheet\s*-?%\}[\s\S]*?\{%-?\s*endstylesheet\s*-?%\}/g, (match) => {
      const css = match.replace(/\{%-?\s*stylesheet\s*-?%\}/, '').replace(/\{%-?\s*endstylesheet\s*-?%\}/, '');
      return `<style>${css.trim()}</style>`;
    })
    .replace(/\{%-?\s*javascript\s*-?%\}[\s\S]*?\{%-?\s*endjavascript\s*-?%\}/g, (match) => {
      const js = match.replace(/\{%-?\s*javascript\s*-?%\}/, '').replace(/\{%-?\s*endjavascript\s*-?%\}/, '');
      return `<script>${js.trim()}</script>`;
    })
    .replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/g, '');
}

async function readThemeFile(relativePath) {
  const filePath = path.join(THEME_ROOT, relativePath);
  const source = await fs.readFile(filePath, 'utf8');
  return stripShopifyBlocks(source);
}

async function loadJson(relativePath) {
  const filePath = path.join(THEME_ROOT, relativePath);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function loadMocks() {
  const mocksDir = path.join(import.meta.dirname, 'mocks');
  const files = await fs.readdir(mocksDir);
  const mocks = {};

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const key = file.replace('.json', '');
    const raw = await fs.readFile(path.join(mocksDir, file), 'utf8');
    mocks[key] = JSON.parse(raw);
  }

  return mocks;
}

function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function getSectionDefaults(sectionType) {
  const sectionPath = path.join(THEME_ROOT, 'sections', `${sectionType}.liquid`);
  const raw = await fs.readFile(sectionPath, 'utf8');
  const schemaMatch = raw.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  const defaultSettings = {};

  if (!schemaMatch) return defaultSettings;

  try {
    const schema = JSON.parse(schemaMatch[1]);
    for (const setting of schema.settings ?? []) {
      if (setting.id && setting.default !== undefined) {
        defaultSettings[setting.id] = setting.default;
      }
    }
  } catch {
    // Schema parse errors are surfaced by theme:check
  }

  return defaultSettings;
}

function createEngine() {
  const engine = new Liquid({
    root: THEME_ROOT,
    extname: '.liquid',
    cache: false,
    strictFilters: false,
    strictVariables: false,
  });

  engine.registerFilter('asset_url', (input) => `/assets/${input}`);
  engine.registerFilter('stylesheet_tag', (input) => `<link rel="stylesheet" href="${input}">`);
  engine.registerFilter('script_tag', (input) => `<script src="${input}" defer></script>`);
  engine.registerFilter('img_url', (input, size) => {
    if (!input) return '';
    const src = typeof input === 'string' ? input : input.src;
    if (!src) return '';
    if (typeof input === 'string' && input.startsWith('http')) return input;
    return size ? `${src}?width=${size}` : src;
  });
  engine.registerFilter('image_url', (input, size) => {
    if (!input) return '';
    if (typeof input === 'string') {
      if (input.startsWith('http')) return input;
      return `/assets/${input}`;
    }
    return engine.filters.img_url(input, size);
  });
  engine.registerFilter('times', (input, multiplier) => Number(input) * Number(multiplier));
  engine.registerFilter('date', (input, format) => {
    const date = input === 'now' ? new Date() : new Date(input);
    if (format === '%Y') return String(date.getFullYear());
    return date.toLocaleDateString();
  });
  engine.registerFilter('money', (cents) => formatMoney(cents));
  engine.registerFilter('money_without_trailing_zeros', (cents) => formatMoney(cents));
  engine.registerFilter('escape', (input) => {
    if (input == null) return '';
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  });
  engine.registerFilter('t', function (key) {
    const translations = this.context.get(['translations']) ?? {};
    const value = key.split('.').reduce((obj, part) => obj?.[part], translations);
    return value ?? key;
  });
  engine.registerFilter('font_modify', (font, property, value) => modifyFont(font, property, value));
  engine.registerFilter('font_url', () => '');
  engine.registerFilter('font_face', () => '');
  engine.registerFilter('preload_tag', () => '');

  class StyleTag extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      this.templates = [];
      const stream = this.liquid.parser.parseStream(remainTokens);

      stream
        .on('tag:endstyle', () => stream.stop())
        .on('template', (tpl) => this.templates.push(tpl))
        .on('end', () => {
          throw new Error('tag style not closed');
        });

      stream.start();
    }

    *render(ctx, emitter) {
      const css = yield this.liquid.renderer.renderTemplates(this.templates, ctx);
      emitter.write(`<style>${css}</style>`);
    }
  }

  class RenderTag extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      const tokenizer = this.tokenizer;
      const fileToken = tokenizer.readQuoted() ?? tokenizer.readIdentifier();
      this.snippet = fileToken.content.replace(/^['"]|['"]$/g, '');

      if (tokenizer.peek() === ',') tokenizer.advance();

      this.hash = new Hash(tokenizer, liquid.options.keyValueSeparator);
    }

    async render(ctx) {
      const vars = await toPromise(this.hash.render(ctx));
      const snippetPath = path.join('snippets', `${this.snippet}.liquid`);
      const source = await readThemeFile(snippetPath);
      return engine.parseAndRender(source, { ...ctx.getAll(), ...vars });
    }
  }

  class FormTag extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      this.templates = [];
      const classMatch = token.args.match(/class:\s*['"]([^'"]+)['"]/);
      this.formClass = classMatch ? `product-form ${classMatch[1]}` : 'product-form';
      const stream = this.liquid.parser.parseStream(remainTokens);

      stream
        .on('tag:endform', () => stream.stop())
        .on('template', (tpl) => this.templates.push(tpl))
        .on('end', () => {
          throw new Error('tag form not closed');
        });

      stream.start();
    }

    *render(ctx, emitter) {
      const inner = yield this.liquid.renderer.renderTemplates(this.templates, ctx);
      emitter.write(
        `<form action="/cart/add" method="post" class="${this.formClass}" data-product-form>${inner}</form>`
      );
    }
  }

  class SectionTag extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      this.sectionType = token.args.trim().replace(/^['"]|['"]$/g, '');
    }

    async render(ctx) {
      const defaults = await getSectionDefaults(this.sectionType);
      const source = await readThemeFile(path.join('sections', `${this.sectionType}.liquid`));
      const section = {
        id: this.sectionType,
        settings: defaults,
        blocks: [],
      };

      return engine.parseAndRender(source, {
        ...ctx.getAll(),
        section,
      });
    }
  }

  engine.registerTag('render', RenderTag);
  engine.registerTag('form', FormTag);
  engine.registerTag('section', SectionTag);
  engine.registerTag('style', StyleTag);

  return engine;
}

function injectLocalFonts(html) {
  const linkTag = `<link rel="stylesheet" href="${GOOGLE_FONTS_STYLESHEET}">`;

  if (html.includes(GOOGLE_FONTS_STYLESHEET)) return html;
  return html.replace('</head>', `  ${linkTag}\n  </head>`);
}

async function renderSnippet(engine, snippetName, context, assignVars = {}) {
  const snippetPath = path.join('snippets', `${snippetName}.liquid`);
  const source = await readThemeFile(snippetPath);
  return engine.parseAndRender(source, { ...context, ...assignVars });
}

function normalizeBlocks(sectionConfig) {
  if (sectionConfig.block_order?.length) {
    return sectionConfig.block_order
      .map((blockId) => {
        const block = sectionConfig.blocks?.[blockId];
        if (!block) return null;
        return {
          id: blockId,
          type: block.type,
          settings: block.settings ?? {},
          shopify_attributes: '',
        };
      })
      .filter(Boolean);
  }

  if (Array.isArray(sectionConfig.blocks)) {
    return sectionConfig.blocks.map((block, index) => ({
      id: block.id ?? `block_${index}`,
      type: block.type,
      settings: block.settings ?? {},
      shopify_attributes: '',
    }));
  }

  return [];
}

function normalizeProduct(product) {
  if (!product) return null;

  const variants = product.variants ?? [
    {
      id: product.id,
      title: 'Default Title',
      price: product.price,
      available: product.available ?? true,
    },
  ];

  const selectedVariant =
    variants.find((variant) => variant.available) ?? variants[0] ?? null;

  return {
    ...product,
    variants,
    selected_or_first_available_variant: selectedVariant,
    available: product.available ?? selectedVariant?.available ?? true,
  };
}

function normalizeProducts(products) {
  return (products ?? []).map((product) => normalizeProduct(product));
}

function buildCollections(products, collectionsList) {
  const collections = {};

  for (const collection of collectionsList ?? []) {
    collections[collection.handle] = {
      ...collection,
      products: products.filter((product) =>
        collection.product_handles?.includes(product.handle) ?? true
      ),
    };
  }

  collections.all = {
    handle: 'all',
    title: 'All Products',
    products,
  };

  return collections;
}

async function renderSection(engine, sectionType, sectionConfig, context) {
  const sectionPath = path.join('sections', `${sectionType}.liquid`);
  const source = await readThemeFile(sectionPath);
  const section = {
    id: sectionConfig.id ?? sectionType,
    settings: sectionConfig.settings ?? {},
    blocks: normalizeBlocks(sectionConfig),
  };

  return engine.parseAndRender(source, {
    ...context,
    section,
  });
}

async function renderJsonTemplate(engine, templateName, context) {
  const template = await loadJson(path.join('templates', `${templateName}.json`));
  const sections = [];

  for (const sectionId of template.order) {
    const sectionConfig = template.sections[sectionId];
    if (!sectionConfig) continue;

    const html = await renderSection(engine, sectionConfig.type, {
      ...sectionConfig,
      id: sectionId,
    }, context);
    sections.push(html);
  }

  return sections.join('\n');
}

function buildRenderContext(mocks, settingsData, localeData, overrides = {}) {
  const products = normalizeProducts(mocks.products);
  const collections = buildCollections(products, mocks.collections);

  return {
    shop: mocks.shop,
    products,
    collections,
    collection: collections.all,
    product: products[0] ?? null,
    linklists: mocks.linklists ?? {},
    settings: expandSettings(settingsData.current),
    request: {
      locale: { iso_code: 'en' },
      page_type: 'index',
    },
    template: { name: 'index' },
    page_title: mocks.shop.name,
    page_description: mocks.shop.description,
    content_for_header: '<!-- Shopify apps/scripts appear here in production -->',
    routes: {
      root_url: '/',
      search_url: '/search',
      cart_url: '/cart',
      account_url: '/account',
    },
    translations: localeData,
    ...overrides,
  };
}

export async function renderPage(templateName = 'index') {
  const engine = createEngine();
  const mocks = await loadMocks();
  const settingsData = await loadJson('config/settings_data.json');
  const localeData = await loadJson('locales/en.default.json');

  const context = buildRenderContext(mocks, settingsData, localeData, {
    request: {
      locale: { iso_code: 'en' },
      page_type: templateName.startsWith('page.') ? 'page' : 'index',
    },
    template: { name: templateName.includes('.') ? templateName.split('.').pop() : templateName },
  });

  const contentForLayout = await renderJsonTemplate(engine, templateName, context);
  const layoutSource = await readThemeFile('layout/theme.liquid');

  const html = await engine.parseAndRender(layoutSource, {
    ...context,
    content_for_layout: contentForLayout,
  });

  return injectLocalFonts(html);
}

function findProductByHandle(products, handle) {
  const normalizedProducts = normalizeProducts(products);
  return (
    normalizedProducts.find((product) => product.handle === handle) ??
    normalizedProducts[0] ??
    null
  );
}

export async function renderProduct(handle = 'salsa-dance-shoes') {
  const engine = createEngine();
  const mocks = await loadMocks();
  const settingsData = await loadJson('config/settings_data.json');
  const localeData = await loadJson('locales/en.default.json');
  const product = findProductByHandle(mocks.products, handle);

  const context = buildRenderContext(mocks, settingsData, localeData, {
    product,
    request: {
      locale: { iso_code: 'en' },
      page_type: 'product',
    },
    template: { name: 'product' },
    page_title: product?.title ?? mocks.shop.name,
    page_description: product?.description ?? mocks.shop.description,
  });

  const contentForLayout = await renderJsonTemplate(engine, 'product', context);
  const layoutSource = await readThemeFile('layout/theme.liquid');

  const html = await engine.parseAndRender(layoutSource, {
    ...context,
    content_for_layout: contentForLayout,
  });

  return injectLocalFonts(html);
}

export async function renderCollection(handle = 'bachata') {
  const engine = createEngine();
  const mocks = await loadMocks();
  const settingsData = await loadJson('config/settings_data.json');
  const localeData = await loadJson('locales/en.default.json');
  const baseContext = buildRenderContext(mocks, settingsData, localeData);
  const collection = baseContext.collections[handle] ?? baseContext.collections.all;

  const context = buildRenderContext(mocks, settingsData, localeData, {
    collection,
    request: {
      locale: { iso_code: 'en' },
      page_type: 'collection',
    },
    template: { name: 'collection' },
    page_title: collection.title,
    page_description: collection.description ?? mocks.shop.description,
  });

  const contentForLayout = await renderJsonTemplate(engine, 'collection', context);
  const layoutSource = await readThemeFile('layout/theme.liquid');

  const html = await engine.parseAndRender(layoutSource, {
    ...context,
    content_for_layout: contentForLayout,
  });

  return injectLocalFonts(html);
}

export async function listSections() {
  const sectionsDir = path.join(THEME_ROOT, 'sections');
  const files = await fs.readdir(sectionsDir);
  return files.filter((file) => file.endsWith('.liquid')).map((file) => file.replace('.liquid', ''));
}

export async function renderSectionPreview(sectionType) {
  const engine = createEngine();
  const mocks = await loadMocks();
  const settingsData = await loadJson('config/settings_data.json');
  const localeData = await loadJson('locales/en.default.json');
  const baseContext = buildRenderContext(mocks, settingsData, localeData);

  const context = {
    ...baseContext,
    collection: baseContext.collections.bachata ?? baseContext.collections.all,
    request: { locale: { iso_code: 'en' } },
  };

  const defaultSettings = await getSectionDefaults(sectionType);
  const html = await renderSection(engine, sectionType, { settings: defaultSettings }, context);

  const fontsHtml = await renderSnippet(engine, 'fonts', context);
  const colorsHtml = await renderSnippet(engine, 'theme-colors', context);
  const previewHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${sectionType} — Tropical Preview</title>
    ${fontsHtml}
    ${colorsHtml}
    <link rel="stylesheet" href="/assets/base.css">
  </head>
  <body>
    ${html}
  </body>
</html>`;

  return injectLocalFonts(previewHtml);
}

export { THEME_ROOT };
