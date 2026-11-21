export function runHeaderAction(action: () => unknown): void {
  try {
    const result = action();
    if (result instanceof Promise) {
      void result.catch(() => {
        /* IPC failures must not become unhandled rejections */
      });
    }
  } catch {
    /* sync throw from action */
  }
}
