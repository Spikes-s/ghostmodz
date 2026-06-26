// Parse fenced markdown code blocks emitted by Spikes Builder, then validate +
// sanitize so the workspace can trust them before writing to the project.

export type ParsedFile = {
  path: string;
  content: string;
  language: string;
};

export type ParseResult = {
  files: ParsedFile[];
  warnings: string[];
};

const LANG_TO_DEFAULT: Record<string, string> = {
  html: "index.html",
  css: "styles.css",
  js: "script.js",
  javascript: "script.js",
  ts: "script.ts",
  typescript: "script.ts",
  jsx: "App.jsx",
  tsx: "App.tsx",
  py: "main.py",
  python: "main.py",
  md: "README.md",
  markdown: "README.md",
  json: "data.json",
};

const LANG_TO_EXT: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  markdown: "md",
  shell: "sh",
  bash: "sh",
};

/** Strip leading ./, /, drive letters, and any .. segments. */
export function sanitizePath(raw: string): string | null {
  let p = raw.trim().replace(/^["'`]|["'`]$/g, "");
  if (!p) return null;
  p = p.replace(/^\.?\/+/, "").replace(/^[a-zA-Z]:[\\/]+/, "");
  p = p.replace(/\\/g, "/");
  const parts = p.split("/").filter((s) => s && s !== ".");
  if (parts.some((s) => s === "..")) return null;
  if (parts.length === 0) return null;
  return parts.join("/");
}

function defaultPathFor(lang: string, i: number): string {
  if (LANG_TO_DEFAULT[lang]) return LANG_TO_DEFAULT[lang];
  const ext = LANG_TO_EXT[lang] ?? lang ?? "txt";
  return `file-${i + 1}.${ext}`;
}

/**
 * Parses a builder reply into a list of files.
 * Supports:
 *   ```tsx file=src/App.tsx
 *   ```ts path="src/lib/x.ts"
 *   ```js
 *   // file: src/main.js
 */
export function parseCodeBlocks(text: string): ParseResult {
  const out: ParsedFile[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  const re = /```([a-zA-Z0-9_+\-]+)?[^\n]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = re.exec(text))) {
    const lang = (m[1] ?? "text").toLowerCase();
    const header = text.slice(m.index, m.index + m[0].indexOf("\n"));
    let body = m[2].replace(/\s+$/g, "");

    // path hints in the fence header: file=, path=, name=
    let path: string | null = null;
    const headerHint = header.match(/(?:file|path|name)\s*=\s*["']?([^\s"'`]+)["']?/i);
    if (headerHint) path = sanitizePath(headerHint[1]);

    // first-line comment hint inside the body
    if (!path) {
      const firstLine = body.split("\n", 1)[0] ?? "";
      const commentHint = firstLine.match(
        /^\s*(?:\/\/|#|<!--|\/\*)\s*(?:file|path)\s*[:=]\s*([^\s*>]+)/i,
      );
      if (commentHint) {
        path = sanitizePath(commentHint[1]);
        if (path) body = body.split("\n").slice(1).join("\n");
      }
    }

    if (!path) path = sanitizePath(defaultPathFor(lang, idx));
    if (!path) {
      warnings.push(`Skipped block ${idx + 1}: invalid path.`);
      idx++;
      continue;
    }
    if (!body.trim()) {
      warnings.push(`Skipped ${path}: empty content.`);
      idx++;
      continue;
    }
    if (seen.has(path)) {
      // Keep the latest; AI sometimes restates files.
      const prev = out.findIndex((f) => f.path === path);
      if (prev >= 0) out.splice(prev, 1);
      warnings.push(`Replaced duplicate ${path} with later version.`);
    }
    seen.add(path);
    out.push({ path, content: body, language: lang });
    idx++;
  }

  return { files: out, warnings };
}
