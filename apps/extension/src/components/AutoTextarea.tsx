import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

interface AutoTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Minimum height in px. The textarea never shrinks below this. */
  minHeight?: number;
  /** Maximum height in px before it starts scrolling. */
  maxHeight?: number;
}

/**
 * A textarea that grows to fit its content and shrinks back down when content
 * is removed, clamped between minHeight and maxHeight. This lets short notes
 * stay compact while longer notes get a comfortably tall editor without the
 * user having to drag the resize handle.
 */
export function AutoTextarea({ minHeight = 60, maxHeight = 480, value, style, onChange, ...rest }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = (el: HTMLTextAreaElement) => {
    // Reset height so scrollHeight reflects the true content height, then clamp.
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  // Resize on mount and whenever the controlled value changes (e.g. when the
  // edit form is populated with an existing note's description).
  useLayoutEffect(() => {
    if (ref.current) resize(ref.current);
  }, [value, minHeight, maxHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(event) => {
        resize(event.currentTarget);
        onChange?.(event);
      }}
      style={{ minHeight, resize: "vertical", ...style }}
      {...rest}
    />
  );
}
