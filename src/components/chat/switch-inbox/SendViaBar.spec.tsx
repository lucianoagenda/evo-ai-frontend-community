/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SendViaBar from './SendViaBar';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key, currentLanguage: 'pt-BR' }),
}));
vi.mock('./SwitchInboxDialog', () => ({ default: () => null }));

let inboxes: any[] = [];
vi.mock('@/store/appDataStore', () => ({ useAppDataStore: () => ({ inboxes }) }));

describe('SendViaBar', () => {
  it('is hidden when the user has only one WhatsApp number', () => {
    inboxes = [{ id: 'a', name: 'Número A', channel_type: 'Channel::Whatsapp', connection_state: 'connected' }];
    const { container } = render(
      <SendViaBar conversationId="c" currentInboxId="a" isWhatsApp onSwitched={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('is hidden for non-WhatsApp conversations', () => {
    inboxes = [
      { id: 'a', name: 'A', channel_type: 'Channel::Whatsapp' },
      { id: 'b', name: 'B', channel_type: 'Channel::Whatsapp' },
    ];
    const { container } = render(
      <SendViaBar conversationId="c" currentInboxId="w" isWhatsApp={false} onSwitched={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the current number and a disconnected warning', () => {
    inboxes = [
      { id: 'a', name: 'Número A', channel_type: 'Channel::Whatsapp', connection_state: 'disconnected' },
      { id: 'b', name: 'Número B', channel_type: 'Channel::Whatsapp', connection_state: 'connected' },
    ];
    render(<SendViaBar conversationId="c" currentInboxId="a" isWhatsApp onSwitched={vi.fn()} />);
    expect(screen.getByText('Número A')).toBeInTheDocument();
    expect(screen.getByText('switchInbox.disconnectedBanner')).toBeInTheDocument();
  });
});
