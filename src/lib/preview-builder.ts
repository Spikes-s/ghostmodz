// Build the srcDoc for the Build Mode preview iframe.
// Supports plain HTML/CSS/JS projects and React/JSX projects via
// @babel/standalone + an esm.sh importmap (no bundler at runtime).

type Pf = { path: string; content: string; language?: string | null };

const REACT_VERSION = "18.3.1";
const BABEL_URL = "https://unpkg.com/@babel/standalone@7.25.6/babel.min.js";

const REACT_IMPORTMAP = `
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@${REACT_VERSION}",
    "react/jsx-runtime": "https://esm.sh/react@${REACT_VERSION}/jsx-runtime",
    "react-dom": "https://esm.sh/react-dom@${REACT_VERSION}",
    "react-dom/client": "https://esm.sh/react-dom@${REACT_VERSION}/client"
  }
}
</script>`;

function isReactProject(files: Pf[]): boolean {
  const hasJsx = files.some((f) => /\.(jsx|tsx)$/i.test(f.path));
  const pkg = files.find((f) => f.path === "package.json");
  let pkgHasReact = false;
  if (pkg) {
    try {
      const j = JSON.parse(pkg.content);
      pkgHasReact = Boolean(j?.dependencies?.react || j?.devDependencies?.react);
    } catch {
      /* ignore */
    }
  }
  return hasJsx || pkgHasReact;
}

function pickEntry(files: Pf[]): Pf | null {
  const priorities = [
    "src/main.tsx", "src/main.jsx", "src/index.tsx", "src/index.jsx",
    "main.tsx", "main.jsx", "index.tsx", "index.jsx",
    "src/App.tsx", "src/App.jsx", "App.tsx", "App.jsx",
  ];
  for (const p of priorities) {
    const f = files.find((x) => x.path === p);
    if (f) return f;
  }
  return files.find((f) => /\.(jsx|tsx)$/i.test(f.path)) ?? null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeForScript(s: string): string {
  // prevent </script> from breaking out of the inline script tag
  return s.replace(/<\/script/gi, "<\\/script");
}

/** Build a virtual module map (path -> JS source) so the in-iframe loader can
 *  resolve relative imports between user files. */
function buildModuleMap(files: Pf[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of files) {
    if (/\.(jsx|tsx|js|mjs|ts)$/i.test(f.path)) out[f.path] = f.content;
    else if (/\.(css)$/i.test(f.path)) out[f.path] = `/* css: ${f.path} */`;
    else if (/\.(json)$/i.test(f.path)) out[f.path] = f.content;
  }
  return out;
}

function buildReactPreview(files: Pf[]): string {
  const entry = pickEntry(files);
  if (!entry) return buildErrorDoc("No JSX/TSX entry file found");

  const modules = buildModuleMap(files);
  const cssFiles = files.filter((f) => /\.css$/i.test(f.path));
  const inlineCss = cssFiles.map((f) => f.content).join("\n\n");

  const modulesJson = JSON.stringify(modules);
  const entryPath = entry.path;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Preview</title>
${REACT_IMPORTMAP}
<style>
  html,body,#root{height:100%}
  body{margin:0;font-family:system-ui,sans-serif;background:#fff;color:#111}
  ${inlineCss}
  .__spikes_err{padding:16px;font-family:ui-monospace,monospace;color:#b91c1c;white-space:pre-wrap}
</style>
<script src="${BABEL_URL}"></script>
</head>
<body>
<div id="root"></div>
<script>
window.__SPIKES_MODULES = ${escapeForScript(modulesJson)};
window.__SPIKES_ENTRY = ${JSON.stringify(entryPath)};
</script>
<script type="module">
const Babel = window.Babel;
const modules = window.__SPIKES_MODULES;
const entry = window.__SPIKES_ENTRY;
const cache = new Map();
const blobs = new Set();

function resolvePath(from, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null;
  const base = from.split('/').slice(0, -1);
  const parts = spec.split('/');
  for (const p of parts) {
    if (p === '..') base.pop();
    else if (p !== '.' && p !== '') base.push(p);
  }
  const guess = base.join('/');
  if (modules[guess]) return guess;
  for (const ext of ['.tsx','.ts','.jsx','.js','.mjs','.json']) {
    if (modules[guess + ext]) return guess + ext;
  }
  for (const idx of ['/index.tsx','/index.ts','/index.jsx','/index.js']) {
    if (modules[guess + idx]) return guess + idx;
  }
  return null;
}

function rewriteImports(src, fromPath) {
  // rewrite relative import/export sources to blob URLs of compiled modules
  const re = /((?:import|export)[^'"\\n]*from\\s*)(['"])(\\.\\/[^'"\\n]+|\\.\\.\\/[^'"\\n]+|\\/[^'"\\n]+)\\2/g;
  return src.replace(re, (m, head, q, spec) => {
    const target = resolvePath(fromPath, spec);
    if (!target) return m;
    const url = compile(target);
    return head + q + url + q;
  }).replace(/import\\s+(['"])(\\.[^'"\\n]+|\\/[^'"\\n]+)\\1\\s*;?/g, (m, q, spec) => {
    const target = resolvePath(fromPath, spec);
    if (!target) return m;
    if (/\\.css$/i.test(target)) return ''; // css already inlined
    const url = compile(target);
    return 'import ' + q + url + q + ';';
  });
}

function compile(path) {
  if (cache.has(path)) return cache.get(path);
  let src = modules[path] ?? '';
  if (/\\.json$/i.test(path)) {
    src = 'export default ' + src;
  } else if (/\\.css$/i.test(path)) {
    src = 'export default {};';
  } else {
    try {
      const presets = [['env',{modules:false}], 'react'];
      if (/\\.tsx?$/i.test(path)) presets.push(['typescript', { isTSX: true, allExtensions: true }]);
      const out = Babel.transform(src, { filename: path, presets });
      src = out.code || '';
    } catch (e) {
      reportError('Compile error in ' + path + ':\\n' + (e && e.message ? e.message : String(e)));
      src = 'export default function(){return null}';
    }
  }
  src = rewriteImports(src, path);
  const blob = new Blob([src], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  blobs.add(url);
  cache.set(path, url);
  return url;
}

function reportError(msg) {
  const root = document.getElementById('root');
  if (!root) return;
  const pre = document.createElement('pre');
  pre.className = '__spikes_err';
  pre.textContent = msg;
  root.innerHTML = '';
  root.appendChild(pre);
  console.error(msg);
}

window.addEventListener('error', (e) => reportError(e.message));
window.addEventListener('unhandledrejection', (e) => reportError(String(e.reason)));

(async () => {
  try {
    const url = compile(entry);
    const mod = await import(url);
    const isEntryLike = /(?:^|\\/)(?:main|index)\\.(?:t|j)sx?$/i.test(entry);
    if (!isEntryLike) {
      const React = await import('react');
      const { createRoot } = await import('react-dom/client');
      const Comp = mod.default || mod.App;
      if (!Comp) { reportError('Entry ' + entry + ' has no default export.'); return; }
      createRoot(document.getElementById('root')).render(React.createElement(Comp));
    }
  } catch (e) {
    reportError(e && e.message ? e.message : String(e));
  }
})();
</script>
</body>
</html>`;
}

function buildHtmlPreview(files: Pf[]): string {
  const indexFile = files.find((f) => f.path === "index.html");
  if (!indexFile) return buildErrorDoc("No index.html in this project");
  let html = indexFile.content;
  for (const f of files) {
    if (f.path === indexFile.path) continue;
    if (f.path.endsWith(".css")) {
      html = html.replace(
        new RegExp(`<link[^>]*href=["']\\.?/?${escapeRe(f.path)}["'][^>]*>`, "g"),
        `<style>${f.content}</style>`,
      );
    } else if (f.path.endsWith(".js")) {
      html = html.replace(
        new RegExp(`<script[^>]*src=["']\\.?/?${escapeRe(f.path)}["'][^>]*></script>`, "g"),
        `<script>${escapeForScript(f.content)}</script>`,
      );
    }
  }
  return html;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildErrorDoc(msg: string): string {
  return `<!doctype html><html><body style="background:#0a0a18;color:#e8e8ff;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;padding:24px;text-align:center"><div><div style="font-size:12px;letter-spacing:.2em;color:#a78bfa;margin-bottom:8px">PREVIEW</div><div>${escapeHtml(msg)}</div></div></body></html>`;
}

export function buildPreviewDoc(files: Pf[]): string {
  if (files.length === 0) return buildErrorDoc("Project is empty");
  if (isReactProject(files)) return buildReactPreview(files);
  return buildHtmlPreview(files);
}
