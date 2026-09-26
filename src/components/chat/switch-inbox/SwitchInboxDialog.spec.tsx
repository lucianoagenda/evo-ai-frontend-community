/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SwitchInboxDialog from './SwitchInboxDialog';
import { isInboxUnavailable, whatsappInboxes } from './switchInboxUtils';
import chatService from '@/services/chat/chatService';
import { toast } from 'sonner';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key, currentLanguage: 'pt-BR' }),
}));
vi.mock('@/services/chat/chatService', () => ({ default: { switchInbox: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const inboxes = [
  { id: 'a', name: 'Número A', channel_type: 'Channel::Whatsapp', connection_state: 'disconnected' },
  { id: 'b', name: 'Número B', channel_type: 'Channel::Whatsapp', connection_state: 'connected' },
  { id: 'c', name: 'Número C', channel_type: 'Channel::Whatsapp', connection_state: 'error' },
  { id: 'w', name: 'Site', channel_type: 'Channel::WebWidget' },
];
vi.mock('@/store/appDataStore', () => ({
  useAppDataStore: () => ({ inboxes }),
}));

describe('switchInboxUtils', () => {
  it('keeps only WhatsApp inboxes', () => {
    expect(whatsappInboxes(inboxes as any).map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('treats disconnected and error as unavailable, unknown as available', () => {
    expect(isInboxUnavailable({ connection_state: 'disconnected' } as any)).toBe(true);
    expect(isInboxUnavailable({ connection_state: 'error' } as any)).toBe(true);
    expect(isInboxUnavailable({ connection_state: 'unknown' } as any)).toBe(false);
    expect(isInboxUnavailable(undefined)).toBe(false);
  });
});

describe('SwitchInboxDialog', () => {
  beforeEach(() => {
    vi.mocked(chatService.switchInbox).mockResolvedValue({ data: { id: 'conv1', inbox_id: 'b' } } as any);
  });

  it('disables the current and unavailable numbers', () => {
    render(
      <SwitchInboxDialog open onOpenChange={vi.fn()} conversationId="conv1" currentInboxId="a" onSwitched={vi.fn()} />,
    );

    expect(screen.getByTestId('switch-inbox-a')).toBeDisabled();
    expect(screen.getByTestId('switch-inbox-c')).toBeDisabled();
    expect(screen.getByTestId('switch-inbox-b')).not.toBeDisabled();
    expect(screen.queryByTestId('switch-inbox-w')).not.toBeInTheDocument();
  });

  it('confirms and switches to the chosen number', async () => {
    const onSwitched = vi.fn();
    render(
      <SwitchInboxDialog open onOpenChange={vi.fn()} conversationId="conv1" currentInboxId="a" onSwitched={onSwitched} />,
    );

    fireEvent.click(screen.getByTestId('switch-inbox-b'));
    expect(chatService.switchInbox).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('switch-inbox-confirm'));

    await waitFor(() => expect(chatService.switchInbox).toHaveBeenCalledWith('conv1', 'b'));
    expect(onSwitched).toHaveBeenCalledWith({ id: 'conv1', inbox_id: 'b' });
  });

  it('explains the refusal reason sent by the backend', async () => {
    vi.mocked(chatService.switchInbox).mockRejectedValue({
      response: {
        status: 422,
        data: { error: { message: 'Conversation inbox cannot be switched', details: { reason: 'target_has_open_conversation' } } },
      },
    });
    render(
      <SwitchInboxDialog open onOpenChange={vi.fn()} conversationId="conv1" currentInboxId="a" onSwitched={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId('switch-inbox-b'));
    fireEvent.click(screen.getByTestId('switch-inbox-confirm'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('switchInbox.reasons.target_has_open_conversation'));
  });
});
