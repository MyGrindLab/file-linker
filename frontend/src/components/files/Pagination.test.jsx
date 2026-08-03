import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from './Pagination';

describe('Pagination', () => {
  it('renders nothing when everything fits on one page (total <= limit)', () => {
    const { container } = render(<Pagination offset={0} limit={20} total={20} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no files at all', () => {
    const { container } = render(<Pagination offset={0} limit={20} total={0} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Page 1 of N" and disables Previous on the first page', () => {
    render(<Pagination offset={0} limit={20} total={45} onChange={() => {}} />);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('disables Next on the last page', () => {
    render(<Pagination offset={40} limit={20} total={45} onChange={() => {}} />);
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });

  it('clicking Next calls onChange with the next page\'s offset', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination offset={0} limit={20} total={45} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('clicking Previous calls onChange with the previous page\'s offset', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination offset={20} limit={20} total={45} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Previous page' }));

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('disables both Previous and Next while busy, even in the middle of the range', () => {
    render(<Pagination offset={20} limit={20} total={45} onChange={() => {}} busy />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});
