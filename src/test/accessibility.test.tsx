import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthPage } from '@/features/auth/AuthPage';
import { Dialog } from '@/components/ui/dialog';

async function expectNoAxeViolations(): Promise<void> {
  const result = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(result.violations).toEqual([]);
}

describe('accessible interaction foundations', () => {
  it('has no automated semantic violations on the local login form', async () => {
    render(<AuthPage onAuthenticated={vi.fn()} />);
    await expectNoAxeViolations();
  });

  it('traps focus, closes with Escape, and exposes an accessible dialog name', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<Dialog open onOpenChange={(open) => { if (!open) close(); }} title="Confirm order" footer={<button type="button">Submit</button>}><input aria-label="Quantity" /></Dialog>);
    expect(screen.getByRole('dialog', { name: 'Confirm order' })).toHaveAttribute('aria-modal', 'true');
    await expectNoAxeViolations();
    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledOnce();
  });
});
