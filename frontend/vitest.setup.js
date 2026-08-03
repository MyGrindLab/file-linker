// Global test setup — loaded by vitest before every test file.
// See the `test.setupFiles` entry in vite.config.js.

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount anything React Testing Library rendered so tests can't leak DOM
// state into each other. RTL only auto-cleans when `globals` is on *and* the
// runner exposes afterEach at import time — doing it explicitly is cheaper
// than debugging why it didn't.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
