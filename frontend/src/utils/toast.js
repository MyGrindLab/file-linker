const listeners = new Set();

export function subscribeToToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitToast(message, type = 'error') {
  listeners.forEach(fn => fn({ id: Date.now() + Math.random(), message, type }));
}
