// [Traggi] Painel do Traggi na barra lateral da conversa: situação do contato no
// agente do Traggi (lead ou cliente) e os botões devolver/reabrir/encerrar/opt-out,
// com as mesmas regras das telas do Traggi. Some quando o Traggi não está
// configurado, o número não está no agente ou a consulta falha.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@evoapi/design-system/badge';
import { Button } from '@evoapi/design-system/button';
import { Card, CardContent, CardHeader } from '@evoapi/design-system/card';
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-4 w-4 text-violet-500" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold truncate">{t('traggiPanel.titulo')}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {situacao.ia_respondendo ? t('traggiPanel.iaRespondendo') : t('traggiPanel.iaSilenciosa')}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-3 pb-3 space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary">{t(`traggiPanel.tipo.${tipo}`)}</Badge>
          <Badge variant="outline">{situacao.status_rotulo}</Badge>
          {situacao.opt_out && <Badge variant="destructive">{t('traggiPanel.optOut')}</Badge>}
        </div>

        {situacao.motivo && (
          <p className="text-xs">
            <span className="text-muted-foreground">{t('traggiPanel.motivo')}: </span>
            {situacao.motivo}
          </p>
        )}
        {situacao.resumo && <p className="text-xs whitespace-pre-line">{situacao.resumo}</p>}

        {(situacao.acoes?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {situacao.acoes?.map(a => (
              <Button
                key={a}
                size="sm"
                variant={VARIANTE[a]}
                data-testid={`traggi-acao-${a}`}
                onClick={() => abrir(a)}
              >
                {t(`traggiPanel.acoes.${a}`)}
              </Button>
            ))}
          </div>
        )}

        {situacao.link && (
          <a
            href={situacao.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t('traggiPanel.abrirNoTraggi')}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>

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
    </Card>
  );
}
