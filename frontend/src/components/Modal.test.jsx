import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

/**
 * A trigger button + Modal, wired the way FilesPage wires it: the trigger
 * opens the dialog and gets focus back when it closes.
 */
function Harness({ busy = false, onCloseSpy } = {}) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onCloseSpy?.();
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open modal</button>
      <Modal
        open={open}
        onClose={close}
        title="Test dialog"
        busy={busy}
        footer={<button type="button">Footer action</button>}
      >
        <input aria-label="Field one" />
        <input aria-label="Field two" />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('moves initial focus into the panel when it opens', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    expect(screen.getByTestId('modal-close')).toHaveFocus();
  });

  it('traps Tab at the last focusable element, wrapping back to the first', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    const closeButton = screen.getByTestId('modal-close');
    const footerButton = screen.getByRole('button', { name: 'Footer action' });

    act(() => footerButton.focus());
    expect(footerButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();
  });

  it('traps Shift+Tab at the first focusable element, wrapping back to the last', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    const closeButton = screen.getByTestId('modal-close');
    const footerButton = screen.getByRole('button', { name: 'Footer action' });

    act(() => closeButton.focus());
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(footerButton).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onCloseSpy = vi.fn();
    render(<Harness onCloseSpy={onCloseSpy} />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument();
  });

  it('blocks Escape while busy', async () => {
    const user = userEvent.setup();
    const onCloseSpy = vi.fn();
    render(<Harness busy onCloseSpy={onCloseSpy} />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCloseSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('modal-panel')).toBeInTheDocument();
  });

  it('blocks a backdrop click while busy', async () => {
    const user = userEvent.setup();
    const onCloseSpy = vi.fn();
    render(<Harness busy onCloseSpy={onCloseSpy} />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    fireEvent.mouseDown(screen.getByTestId('modal-overlay'));
    fireEvent.click(screen.getByTestId('modal-overlay'));

    expect(onCloseSpy).not.toHaveBeenCalled();
  });

  it('returns focus to the element that opened it once it closes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open modal' });

    await user.click(trigger);
    expect(screen.getByTestId('modal-panel')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
