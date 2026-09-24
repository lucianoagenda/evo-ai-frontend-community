import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PipelineItem } from '@/types/analytics';
import { getTraggiUserId, disableTraggiCrmUser } from './traggiService';

vi.mock('@/store/authStore', () => ({
  useAuthStore: { getState: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer tok' }) }) },
}));

const item = (custom_fields?: Record<string, unknown>) => ({ custom_fields }) as unknown as PipelineItem;

describe('getTraggiUserId', () => {
  it('lê traggi_id numérico ou string numérica', () => {
    expect(getTraggiUserId(item({ traggi_id: 76 }))).toBe(76);
    expect(getTraggiUserId(item({ traggi_id: ' 76 ' }))).toBe(76);
  });

  it('retorna null quando o atributo não existe, está vazio ou é inválido', () => {
    expect(getTraggiUserId(null)).toBeNull();
    expect(getTraggiUserId(item())).toBeNull();
    expect(getTraggiUserId(item({}))).toBeNull();
    expect(getTraggiUserId(item({ traggi_id: '' }))).toBeNull();
    expect(getTraggiUserId(item({ traggi_id: null }))).toBeNull();
    expect(getTraggiUserId(item({ traggi_id: 'abc' }))).toBeNull();
    expect(getTraggiUserId(item({ traggi_id: 0 }))).toBeNull();
    expect(getTraggiUserId(item({ traggi_id: -3 }))).toBeNull();
  });
});

describe('disableTraggiCrmUser', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('chama o proxy com user_id e o token da sessão', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await disableTraggiCrmUser(76);
    expect(fetchMock).toHaveBeenCalledWith('/traggi-api/crm_user_disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ user_id: 76 }),
    });
  });

  it('lança erro quando a resposta não é ok', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"traggi_not_configured"}', { status: 503 }));
    await expect(disableTraggiCrmUser(76)).rejects.toThrow(/503/);
  });
});
