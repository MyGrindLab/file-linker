/**
 * Toolchain smoke test — owned by the test harness, not by a feature.
 *
 * It asserts that vitest + jsdom + React Testing Library + jest-dom matchers
 * are all actually wired together. If this file is the only thing that breaks,
 * the problem is the harness (vite.config.js `test` block / vitest.setup.js),
 * not the app.
 *
 * Keep it. Real component tests go in files next to what they test.
 */

import { render, screen } from '@testing-library/react';
import { useState } from 'react';

function Greeter({ name }) {
  const [greeting] = useState(`hello ${name}`);
  return <p>{greeting}</p>;
}

describe('frontend test harness', () => {
  it('renders a React component into jsdom', () => {
    render(<Greeter name="file-linker" />);
    expect(screen.getByText('hello file-linker')).toBeInTheDocument();
  });

  it('has a browser-like environment', () => {
    expect(typeof window).toBe('object');
    expect(typeof document.querySelector).toBe('function');
  });
});
