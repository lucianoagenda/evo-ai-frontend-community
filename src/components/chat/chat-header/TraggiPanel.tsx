// [Traggi] Faixa do Traggi no header da conversa, ao lado do nome: situação do contato no
// agente do Traggi (lead ou cliente) e os botões devolver/reabrir/encerrar/opt-out,
// com as mesmas regras das telas do Traggi. Some quando o Traggi não está
// configurado, o número não está no agente ou a consulta falha.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@evoapi/design-system/badge';
import { Button } from '@evoapi/design-system/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@evoapi/design-system/dialog';
import { Label } from '@evoapi/design-system/label';
import { Textarea } from '@evoapi/design-system/textarea';
import { Bot, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  executarTraggiAcao,
  getTraggiSituacao,
  type TraggiAcao,
  type TraggiAcaoPayload,
  type TraggiSituacao,
} from '@/services/traggi/traggiService';

interface TraggiPanelProps {
  conversationId: string;
}

const VARIANTE: Record<TraggiAcao, 'default' | 'outline' | 'destructive'> = {
  devolver: 'default',
  reabrir: 'outline',
  encerrar: 'outline',
  opt_out: 'destructive',
};

export default function TraggiPanel({ conversationId }: TraggiPanelProps) {
  const { t } = useLanguage('chat');
  const [situacao, setSituacao] = useState<TraggiSituacao | null>(null);
  const [acao, setAcao] = useState<TraggiAcao | null>(null);
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setSituacao(null);
    getTraggiSituacao(conversationId)
      .then(s => {
        if (!cancelado) setSituacao(s);
      })
      .catch(err => {
        // O painel é um extra: sem Traggi, a barra lateral segue normal.
        console.error('[TraggiPanel] Falha ao consultar o Traggi:', err);
      });
    return () => {
      cancelado = true;
    };
  }, [conversationId]);

  if (!situacao?.configured || !situacao.id || (situacao.tipo !== 'lead' && situacao.tipo !== 'cliente')) {
    return null;
  }
  const tipo = situacao.tipo;
  const id = situacao.id;
  const motivos = situacao.motivos ?? [];

  const abrir = (escolhida: TraggiAcao) => {
    setObservacao('');
    setMotivo('');
    setAcao(escolhida);
  };

  const confirmar = async () => {
    if (!acao) return;
    const payload: TraggiAcaoPayload = { tipo, id, acao };
    if (acao === 'encerrar') {
      if (observacao.trim()) payload.observacao = observacao.trim();
      if (motivo) payload.motivo_categoria = motivo;
    }
    setSalvando(true);
    try {
      const nova = await executarTraggiAcao(conversationId, payload);
      setSituacao(nova);
      toast.success(t(`traggiPanel.sucesso.${acao}`));
      setAcao(null);
    } catch (err) {
      toast.error(apiErrorMessage(err) || t('traggiPanel.erro'));
    } finally {
      setSalvando(false);
    }
  };

  const iaTexto = situacao.ia_respondendo ? t('traggiPanel.iaRespondendo') : t('traggiPanel.iaSilenciosa');
  // Resumo e motivo ficam no tooltip do ícone: o header não tem espaço para texto longo.
  const detalhes = [
    `${t('traggiPanel.titulo')} — ${iaTexto}`,
    situacao.motivo ? `${t('traggiPanel.motivo')}: ${situacao.motivo}` : null,
    situacao.resumo,
  ]
    .filter(Boolean)
    .join('\n\n');

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="traggi-panel">
      <span
        className={`inline-flex items-center justify-center rounded-full p-1 ${
          situacao.ia_respondendo ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/20' : 'bg-muted text-muted-foreground'
        }`}
        title={detalhes}
        aria-label={iaTexto}
        data-testid="traggi-ia"
      >
        <Bot className="h-3.5 w-3.5" />
      </span>
      <Badge variant="secondary" className="h-6 text-xs">
        {t(`traggiPanel.tipo.${tipo}`)}
      </Badge>
      <Badge variant="outline" className="h-6 text-xs">
        {situacao.status_rotulo}
      </Badge>
      {situacao.opt_out && (
        <Badge variant="destructive" className="h-6 text-xs">
          {t('traggiPanel.optOut')}
        </Badge>
      )}

      {situacao.acoes?.map(a => (
        <Button
          key={a}
          size="sm"
          variant={VARIANTE[a]}
          className="h-6 px-2 text-xs"
          data-testid={`traggi-acao-${a}`}
          onClick={() => abrir(a)}
        >
          {t(`traggiPanel.acoes.${a}`)}
        </Button>
      ))}

      {situacao.link && (
        <a
          href={situacao.link}
          target="_blank"
          rel="noopener noreferrer"
          title={t('traggiPanel.abrirNoTraggi')}
          aria-label={t('traggiPanel.abrirNoTraggi')}
          className="inline-flex items-center text-primary hover:text-primary/80"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      <Dialog open={acao !== null} onOpenChange={aberto => !aberto && !salvando && setAcao(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{acao ? t(`traggiPanel.acoes.${acao}`) : ''}</DialogTitle>
          {acao && <p className="text-sm">{t(`traggiPanel.confirmar.${acao}.${tipo}`)}</p>}

          {acao === 'encerrar' && (
            <div className="space-y-3">
              {motivos.length > 0 && (
                <div className="space-y-1">
                  <Label htmlFor="traggi-motivo">{t('traggiPanel.motivoCampo')}</Label>
                  <select
                    id="traggi-motivo"
                    data-testid="traggi-motivo"
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">{t('traggiPanel.semMotivo')}</option>
                    {motivos.map(m => (
                      <option key={m.chave} value={m.chave}>
                        {m.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="traggi-observacao">{t('traggiPanel.observacao')}</Label>
                <Textarea
                  id="traggi-observacao"
                  data-testid="traggi-observacao"
                  value={observacao}
                  maxLength={2000}
                  onChange={e => setObservacao(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAcao(null)} disabled={salvando}>
              {t('traggiPanel.cancelar')}
            </Button>
            <Button
              data-testid="traggi-confirmar"
              variant={acao ? VARIANTE[acao] : 'default'}
              onClick={confirmar}
              disabled={salvando}
            >
              {t('traggiPanel.confirmarBotao')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
