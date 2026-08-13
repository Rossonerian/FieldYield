import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import { ActionSearchBar, type SearchItem } from '@/features/search/ActionSearchBar';

it('supports the global shortcut and keyboard execution of a search result', async () => {
  const action = vi.fn();
  const items: SearchItem[] = [{
    id: 'market-ha9',
    title: 'Test Player',
    subtitle: 'Open HA9 asset',
    type: 'Player',
    category: 'Players',
    icon: <span aria-hidden="true">P</span>,
    action,
  }];
  const user = userEvent.setup();
  render(<ActionSearchBar items={items} />);

  await user.keyboard('{Control>}k{/Control}');
  const search = screen.getByRole('combobox');
  expect(search).toHaveFocus();
  await user.type(search, 'HA9');
  expect(await screen.findByRole('option', { name: /Test Player/ })).toBeVisible();
  await user.keyboard('{Enter}');

  expect(action).toHaveBeenCalledOnce();
});
