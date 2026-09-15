import { useEffect, useRef, useState, RefObject } from "react";

/**
 * Measures the inline width of an element and keeps it in sync via ResizeObserver.
 * Returns a ref to attach to the element and the current width (never below `min`).
 * Extracted from the pattern used by SamplePlayer / RelatedSamplesSection.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(
  min = 40,
  initial = min
): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const update = () => {
      setWidth(Math.max(min, Math.floor(node.clientWidth)));
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [min]);

  return [ref, width];
}
