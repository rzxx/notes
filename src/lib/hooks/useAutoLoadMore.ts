import * as React from "react";

export function useAutoLoadMore({
  enabled,
  onVisible,
  rootMargin = "200px",
}: {
  enabled: boolean;
  onVisible: () => void;
  rootMargin?: string;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onVisible();
          }
        });
      },
      { rootMargin },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [enabled, onVisible, rootMargin]);

  return ref;
}
