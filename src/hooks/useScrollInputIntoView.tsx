import { useCallback } from 'react';

/**
 * Returns an onFocus handler that scrolls the focused input into view
 * after the mobile keyboard appears. Attach to inputs/textareas inside
 * scrollable dialog/sheet panels.
 */
export function useScrollInputIntoView() {
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    // Small delay lets the virtual keyboard finish opening
    requestAnimationFrame(() => {
      setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 120);
    });
  }, []);

  return { handleFocus };
}
