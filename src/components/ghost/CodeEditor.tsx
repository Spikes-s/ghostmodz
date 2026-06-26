import Editor, { type OnMount, loader } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

// Use CDN to keep bundle slim and avoid worker plumbing.
loader.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs" } });

type Props = {
  value: string;
  language: string;
  onChange: (value: string) => void;
  onSave?: () => void;
};

// Map our inferLanguage strings to Monaco language IDs
const LANG: Record<string, string> = {
  javascript: "javascript",
  typescript: "typescript",
  html: "html",
  css: "css",
  json: "json",
  markdown: "markdown",
  python: "python",
  go: "go",
  rust: "rust",
  java: "java",
  sql: "sql",
  text: "plaintext",
};

export function CodeEditor({ value, language, onChange, onSave }: Props) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    // Ghost Mods cyber theme
    monaco.editor.defineTheme("ghost-cyber", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "5a4a8a", fontStyle: "italic" },
        { token: "keyword", foreground: "c084fc" },
        { token: "string", foreground: "7dd3fc" },
        { token: "number", foreground: "f0abfc" },
        { token: "type", foreground: "67e8f9" },
        { token: "function", foreground: "a78bfa" },
        { token: "variable", foreground: "e8e8ff" },
        { token: "tag", foreground: "c084fc" },
        { token: "attribute.name", foreground: "67e8f9" },
        { token: "attribute.value", foreground: "7dd3fc" },
      ],
      colors: {
        "editor.background": "#0a0a18",
        "editor.foreground": "#e8e8ff",
        "editorLineNumber.foreground": "#3a2a6a",
        "editorLineNumber.activeForeground": "#c084fc",
        "editor.selectionBackground": "#3a1a6a66",
        "editor.lineHighlightBackground": "#15102a",
        "editorCursor.foreground": "#c084fc",
        "editorIndentGuide.background": "#1a1432",
        "editorIndentGuide.activeBackground": "#3a2a6a",
        "editor.findMatchBackground": "#7c3aed44",
        "editor.findMatchHighlightBackground": "#7c3aed22",
        "scrollbarSlider.background": "#2a1a5a55",
        "scrollbarSlider.hoverBackground": "#3a2a6a88",
      },
    });
    monaco.editor.setTheme("ghost-cyber");

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSave?.());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () =>
      editor.getAction("actions.find")?.run(),
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () =>
      editor.getAction("editor.action.formatDocument")?.run(),
    );
  };

  // Keep latest onSave callback bound
  useEffect(() => {
    if (!editorRef.current) return;
  }, [onSave]);

  return (
    <Editor
      value={value}
      language={LANG[language] ?? "plaintext"}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      theme="ghost-cyber"
      loading={
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground font-mono">
          loading editor…
        </div>
      }
      options={{
        fontFamily: "ui-monospace, 'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: true, side: "right", renderCharacters: false },
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: "on",
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        formatOnPaste: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: { other: true, comments: false, strings: true },
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: "all",
      }}
    />
  );
}
