export const safeStringify = (obj: any, space?: string | number): string => {
  const cache = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return undefined;
        }
        cache.add(value);
        if (typeof value.toDate === 'function') {
          try {
            return value.toDate().toISOString();
          } catch {
            // fallback if toDate fails
          }
        }
      }
      return value;
    },
    space
  );
};
