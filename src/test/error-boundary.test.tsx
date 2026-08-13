import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/app/ErrorBoundary';

function BrokenView(): never {
  throw new Error('render failed');
}

describe('ErrorBoundary', () => {
  it('renders a safe recovery screen when a child fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ErrorBoundary><BrokenView /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText(/account data was not changed/i)).toBeInTheDocument();
  });
});
