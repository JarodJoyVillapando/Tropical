import express from 'express';
import chokidar from 'chokidar';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { renderPage, renderCollection, renderProduct, renderSectionPreview, listSections, THEME_ROOT } from './liquid-engine.mjs';

const PORT = process.env.PORT ?? 9292;
const app = express();

app.use('/assets', express.static(path.join(THEME_ROOT, 'assets')));

app.get('/', async (_req, res) => {
  try {
    const html = injectLiveReload(await renderPage('index'));
    res.type('html').send(html);
  } catch (error) {
    res.status(500).send(formatError('Homepage render failed', error));
  }
});

app.get('/pages/:handle', async (req, res) => {
  try {
    const templateName = `page.${req.params.handle}`;
    const html = injectLiveReload(await renderPage(templateName));
    res.type('html').send(html);
  } catch (error) {
    res.status(500).send(formatError(`Page "${req.params.handle}" render failed`, error));
  }
});

app.get('/collections/:handle', async (req, res) => {
  try {
    const html = injectLiveReload(await renderCollection(req.params.handle));
    res.type('html').send(html);
  } catch (error) {
    res.status(500).send(formatError(`Collection "${req.params.handle}" render failed`, error));
  }
});

app.get('/products/:handle', async (req, res) => {
  try {
    const html = injectLiveReload(await renderProduct(req.params.handle));
    res.type('html').send(html);
  } catch (error) {
    res.status(500).send(formatError(`Product "${req.params.handle}" render failed`, error));
  }
});

app.get('/sections', async (_req, res) => {
  try {
    const sections = await listSections();
    const links = sections
      .map((name) => `<li><a href="/sections/${name}">${name}</a></li>`)
      .join('\n');

    res.type('html').send(injectLiveReload(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Sections — Tropical Preview</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1.5rem; }
      h1 { font-size: 1.5rem; }
      ul { line-height: 2; }
      a { color: #1a5c4a; }
    </style>
  </head>
  <body>
    <h1>Section previews</h1>
    <p>Browse individual sections in isolation.</p>
    <ul>${links}</ul>
    <p><a href="/">← Back to homepage</a></p>
  </body>
</html>`));
  } catch (error) {
    res.status(500).send(formatError('Section list failed', error));
  }
});

app.get('/sections/:name', async (req, res) => {
  try {
    const html = injectLiveReload(await renderSectionPreview(req.params.name));
    res.type('html').send(html);
  } catch (error) {
    res.status(500).send(formatError(`Section "${req.params.name}" render failed`, error));
  }
});

function formatError(title, error) {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Error</title></head>
  <body>
    <h1>${title}</h1>
    <pre>${error.stack ?? error.message}</pre>
  </body>
</html>`;
}

function injectLiveReload(html) {
  const script = `
<script>
  (function () {
    const ws = new WebSocket('ws://' + location.host);
    ws.onmessage = () => location.reload();
  })();
</script>`;

  return html.replace('</body>', `${script}</body>`);
}

const server = app.listen(PORT, () => {
  console.log('');
  console.log('  Tropical theme — local preview');
  console.log('  ─────────────────────────────');
  console.log(`  Homepage:     http://127.0.0.1:${PORT}`);
  console.log(`  Collections:  http://127.0.0.1:${PORT}/collections/bachata`);
  console.log(`  Products:     http://127.0.0.1:${PORT}/products/salsa-dance-shoes`);
  console.log(`  Sections:     http://127.0.0.1:${PORT}/sections`);
  console.log('');
  console.log('  Connect a Shopify store later with: npm run theme:dev');
  console.log('');
});

const wss = new WebSocketServer({ server });

function broadcastReload() {
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send('reload');
  }
}

chokidar
  .watch([
    path.join(THEME_ROOT, 'assets'),
    path.join(THEME_ROOT, 'layout'),
    path.join(THEME_ROOT, 'sections'),
    path.join(THEME_ROOT, 'snippets'),
    path.join(THEME_ROOT, 'templates'),
    path.join(THEME_ROOT, 'locales'),
    path.join(THEME_ROOT, 'dev/mocks'),
  ], { ignoreInitial: true })
  .on('all', () => broadcastReload());
