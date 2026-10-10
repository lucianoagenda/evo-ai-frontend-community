import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import type { ConversationFilter } from '@/types/chat/api';

vi.mock('@/hooks/chat/useWebSocket', () => ({
  useWebSocket: () => ({ isConnected: false, sendTypingOn: vi.fn(), sendTypingOff: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', pubsub_token: 'token-1' } }),
}));

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const getConversations = vi.fn();

vi.mock('@/services/chat/chatService', () => ({
  chatService: {
    getConversations: (...args: unknown[]) => getConversations(...args),
    filterConversations: vi.fn(),
  },
}));

import { ChatProvider, useChatContext } from './ChatContext';

const statusFilter = (status: string): ConversationFilter => ({
  attribute_key: 'status',
  filter_operator: 'equal_to',
  values: [status],
  query_operator: 'and',
});

// Faz o que a página de Conversas faz no mount: aplica os filtros salvos.
// Efeitos do filho rodam ANTES dos do provider, então qualquer "restore" do
// provider que mexa em activeFilters roda depois e sobrescreve este apply.
function Probe({ toApply }: { toApply: ConversationFilter[] }) {
  const { filters, conversations } = useChatContext();

  React.useEffect(() => {
    void filters.applyFilters(
      toApply,
      (c, p, q) => conversations.setConversations(c, p, q),
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <span data-testid="active">{JSON.stringify(filters.state.activeFilters)}</span>;
}

describe('ChatContext — filtros ao entrar na tela de Conversas', () => {
  beforeEach(() => {
    localStorage.clear();
    getConversations.mockReset();
    getConversations.mockResolvedValue({ data: [], meta: { pagination: { page: 1, total: 0 } } });
  });

  it('os filtros ativos são os que a página aplicou, não um estado antigo do localStorage', async () => {
    // Estado antigo salvo por uma visita anterior.
    localStorage.setItem('crm-chat-state', JSON.stringify({ activeFilters: [statusFilter('all')] }));

    const pending = [statusFilter('pending')];

    await act(async () => {
      render(
        <ChatProvider>
          <Probe toApply={pending} />
        </ChatProvider>,
      );
    });

    // A lista foi buscada com "pending"; os chips/realtime têm que concordar.
    expect(getConversations).toHaveBeenCalled();
    expect(JSON.parse(screen.getByTestId('active').textContent || '[]')).toEqual(pending);
  });
});
