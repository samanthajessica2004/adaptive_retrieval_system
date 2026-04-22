import { useState, useCallback, useEffect } from "react";

const MAX_ITEMS = 8;

export function useRecentQueries(key) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // quota / disabled — ignore
    }
  }, [key, items]);

  const push = useCallback((query) => {
    const q = (query || "").trim();
    if (!q) return;
    setItems((prev) => {
      const deduped = prev.filter((x) => x.toLowerCase() !== q.toLowerCase());
      return [q, ...deduped].slice(0, MAX_ITEMS);
    });
  }, []);

  const remove = useCallback((query) => {
    setItems((prev) => prev.filter((x) => x !== query));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, push, remove, clear };
}
