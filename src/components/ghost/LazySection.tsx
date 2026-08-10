import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Defers rendering heavy below-the-fold sections until they are close to the
 * viewport. Falls back to rendering immediately when IntersectionObserver is
 * unavailable so content is never permanently hidden.
 */
export function LazySection({
  children,
  minHeight = 320,
  rootMargin = "400px",
}: {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    // Safety net: never leave a section blank for long.
    const t = window.setTimeout(() => setVisible(true), 2500);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, [rootMargin]);

  return (
    <div ref={ref} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
}
