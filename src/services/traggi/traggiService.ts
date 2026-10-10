// [Traggi] Integração com a API do Traggi.
//
// A chamada NÃO vai direto para app.traggi.com.br: o navegador chama o proxy
// same-origin `/traggi-api/...` servido pelo nginx do container, que injeta o
// header `Api-Key` a partir da variável de ambiente TRAGGI_API_KEY (ver
// docker-entrypoint.sh). Assim a chave nunca chega ao bundle/navegador.
import api from '@/services/core/api';
import { useAuthStore } from '@/store/authStore';
import { extractData } from '@/utils/apiHelpers';
import type { PipelineItem } from '@/types/analytics';

const TRAGGI_PROXY_BASE = '/traggi-api';

/**
 * Lê o atributo `traggi_id` do card. Retorna null quando o atributo não existe,
 * está vazio ou não é um id numérico válido — nesses casos nada deve ser feito.
 */
export function getTraggiUserId(item: PipelineItem | null | undefined): number | null {
  const raw = item?.custom_fields?.traggi_id;
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Desativa o usuário no parâmetro de CRM do Traggi. Lança erro se falhar. */
export async function disableTraggiCrmUser(userId: number): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authHeader = useAuthStore.getState().getAuthHeader();
  if (authHeader) headers.Authorization = authHeader.Authorization;

  const response = await fetch(`${TRAGGI_PROXY_BASE}/crm_user_disable`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Traggi crm_user_disable falhou (${response.status}) ${detail}`.trim());
  }
}

// =============================================================================
// [Traggi] Painel do Traggi na barra lateral da conversa
// =============================================================================
// Diferente do proxy acima, vai pelo backend do CRM (/conversations/:id/traggi):
// ele confere o acesso à conversa e usa o telefone do contato, nunca um
// telefone vindo do navegador.

export type TraggiAcao = 'devolver' | 'reabrir' | 'encerrar' | 'opt_out';

export interface TraggiMotivo {
  chave: string;
  rotulo: string;
}

export interface TraggiSituacao {
  configured: boolean;
  tipo?: 'lead' | 'cliente' | 'nenhum';
  id?: number;
  status?: string;
  status_rotulo?: string;
  nome?: string;
  salao?: string;
  ia_respondendo?: boolean;
  opt_out?: boolean;
  resumo?: string | null;
  motivo?: string | null;
  atualizado_em?: string | null;
  acoes?: TraggiAcao[];
  motivos?: TraggiMotivo[];
  link?: string;
}

export interface TraggiAcaoPayload {
  tipo: 'lead' | 'cliente';
  id: number;
  acao: TraggiAcao;
  observacao?: string;
  motivo_categoria?: string;
}

export async function getTraggiSituacao(conversationId: string): Promise<TraggiSituacao> {
  const response = await api.get(`/conversations/${conversationId}/traggi`);
  return extractData<TraggiSituacao>(response);
}

export async function executarTraggiAcao(conversationId: string, payload: TraggiAcaoPayload): Promise<TraggiSituacao> {
  const response = await api.post(`/conversations/${conversationId}/traggi/acao`, payload);
  return extractData<TraggiSituacao>(response);
}
