// A minimal observable value. It knows nothing about Svelte or Solid, which is the
// point: on pages with two islands, both subscribe to the same instances, so the two
// frameworks stay in sync without knowing about each other.
export interface Store<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: (value: T) => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();
  return {
    get: () => value,
    set(next) {
      value = next;
      listeners.forEach((listener) => listener(value));
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(value);
      return () => listeners.delete(listener);
    },
  };
}
