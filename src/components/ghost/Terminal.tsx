import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export type TerminalProps = {
  lines: string[];
  onRun: (cmd: string) => void;
  onClose: () => void;
  title?: string;
};

export function Terminal({ lines, onRun, onClose, title = "GHOST SHELL" }: TerminalProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number>(-1);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  return (
    <div className="h-48 border-t border-border/40 bg-black/80 flex flex-col">
      <div className="flex items-center justify-between border-b border-border/40 px-2 py-1">
        <span className="text-[10px] font-mono text-secondary">{title}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-destructive">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 py-1 font-mono text-[11px] text-secondary whitespace-pre-wrap"
      >
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      <div className="flex items-center border-t border-border/40 px-2 py-1 font-mono text-xs">
        <span className="text-primary">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const cmd = input.trim();
              if (cmd) {
                onRun(cmd);
                setHistory((h) => [...h, cmd]);
                setHistIdx(-1);
              }
              setInput("");
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (history.length === 0) return;
              const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
              setHistIdx(next);
              setInput(history[next] ?? "");
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              if (histIdx < 0) return;
              const next = histIdx + 1;
              if (next >= history.length) {
                setHistIdx(-1);
                setInput("");
              } else {
                setHistIdx(next);
                setInput(history[next]);
              }
            }
          }}
          className="flex-1 bg-transparent px-2 outline-none text-secondary"
          autoFocus
        />
      </div>
    </div>
  );
}
