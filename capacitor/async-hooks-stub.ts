/**
 * Browser stub for `node:async_hooks`.
 *
 * The TanStack Start client runtime creates an `AsyncLocalStorage` at import
 * time to hold its request context. In the SPA/iOS build there is no Node
 * runtime, and the default bundler shim resolves to an empty object, so
 * `new AsyncLocalStorage()` threw "AsyncLocalStorage is not a constructor" and
 * the whole app failed to boot (blank screen, only the background colour).
 *
 * A single-threaded browser has no async context to track, so a trivial
 * store-holder is a complete replacement for the parts Start actually uses.
 */
export class AsyncLocalStorage<T> {
  private store: T | undefined;

  getStore(): T | undefined {
    return this.store;
  }

  run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R {
    const previous = this.store;
    this.store = store;
    try {
      return callback(...args);
    } finally {
      this.store = previous;
    }
  }

  enterWith(store: T): void {
    this.store = store;
  }

  exit<R>(callback: (...args: unknown[]) => R, ...args: unknown[]): R {
    const previous = this.store;
    this.store = undefined;
    try {
      return callback(...args);
    } finally {
      this.store = previous;
    }
  }

  disable(): void {
    this.store = undefined;
  }
}

export class AsyncResource {
  runInAsyncScope<R>(fn: (...args: unknown[]) => R, thisArg?: unknown, ...args: unknown[]): R {
    return fn.apply(thisArg, args);
  }
}

export function executionAsyncId(): number {
  return 0;
}

export function triggerAsyncId(): number {
  return 0;
}

export function createHook(): { enable(): void; disable(): void } {
  return { enable() {}, disable() {} };
}

export default { AsyncLocalStorage, AsyncResource, executionAsyncId, triggerAsyncId, createHook };
