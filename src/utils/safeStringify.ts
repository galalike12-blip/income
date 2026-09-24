// Global circular reference defense for JSON.stringify
// Ensures third-party libraries (Firebase, WebChannel, GoogleGenAI, DevTools, etc.)
// never crash the app with "Converting circular structure to JSON"

const isPatchedKey = Symbol.for('__isCircularSafeStringify__');

if (typeof globalThis !== 'undefined' && globalThis.JSON && !(globalThis.JSON.stringify as any)[isPatchedKey]) {
  const nativeStringify = globalThis.JSON.stringify;

  const safeStringifyGlobal = function(value: any, replacer?: any, space?: any) {
    const isFn = typeof replacer === 'function';
    const isArr = Array.isArray(replacer);
    const seen = new WeakSet();

    const wrappedReplacer = function(this: any, key: string, val: any) {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return undefined; // Drop circular reference
        }
        seen.add(val);

        // Firestore Timestamp
        if (typeof val.toDate === 'function') {
          try {
            return val.toDate().toISOString();
          } catch {
            // fallback
          }
        }

        // Firestore DocumentReference
        if (val.firestore && typeof val.path === 'string') {
          return val.path;
        }
      }

      if (isFn) {
        return replacer.call(this, key, val);
      }
      return val;
    };

    try {
      if (isArr) {
        return nativeStringify.call(globalThis.JSON, value, replacer, space);
      }
      return nativeStringify.call(globalThis.JSON, value, wrappedReplacer, space);
    } catch (err) {
      try {
        const fallbackSeen = new WeakSet();
        return nativeStringify.call(globalThis.JSON, value, (k, v) => {
          if (typeof v === 'object' && v !== null) {
            if (fallbackSeen.has(v)) return undefined;
            fallbackSeen.add(v);
          }
          return v;
        }, space);
      } catch {
        return typeof value === 'object' && value !== null ? (Array.isArray(value) ? '[]' : '{}') : '""';
      }
    }
  };

  (safeStringifyGlobal as any)[isPatchedKey] = true;
  globalThis.JSON.stringify = safeStringifyGlobal;
}

export const safeStringify = (obj: any, space?: string | number): string => {
  try {
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
          if (value.firestore && typeof value.path === 'string') {
            return value.path;
          }
        }
        return value;
      },
      space
    );
  } catch (err) {
    console.warn('safeStringify caught error:', err);
    try {
      if (typeof obj === 'object' && obj !== null) {
        return Array.isArray(obj) ? '[]' : '{}';
      }
      return String(obj);
    } catch {
      return '{}';
    }
  }
};

