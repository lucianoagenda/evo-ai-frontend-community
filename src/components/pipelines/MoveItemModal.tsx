// [Traggi] "Mover para…": move o card para qualquer etapa de qualquer pipeline ativo.
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@evoapi/design-system';
import { useLanguage } from '@/hooks/useLanguage';
import { pipelinesService } from '@/services/pipelines';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { Pipeline, PipelineItem } from '@/types/analytics';

export interface MoveItemTarget {
  pipelineId: string;
  pipelineName: string;
  samePipeline: boolean;
}

interface MoveItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PipelineItem | null;
  currentPipelineId: string;
  onMoved: (target: MoveItemTarget) => void;
}

export default function MoveItemModal({ open, onOpenChange, item, currentPipelineId, onMoved }: MoveItemModalProps) {
  const { t } = useLanguage('pipelines');
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState(currentPipelineId);
  const [stageId, setStageId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset só ao abrir: depender de `t` recarregaria a lista e desfaria a escolha do usuário.
  useEffect(() => {
    if (!open) return;
    setPipelineId(currentPipelineId);
    setStageId(null);
    setNotes('');
    setError(null);
    setLoadFailed(false);
    pipelinesService
      .getPipelines({ is_active: true })
      .then(resp => setPipelines(resp?.data || []))
      .catch(() => setLoadFailed(true));
  }, [open, currentPipelineId]);

  const selectedPipeline = useMemo(
    () => pipelines.find(p => String(p.id) === String(pipelineId)),
    [pipelines, pipelineId],
  );
  const samePipeline = String(pipelineId) === String(currentPipelineId);

  const handleSubmit = async () => {
    if (!item || !stageId || !selectedPipeline) return;
    setSaving(true);
    setError(null);
    try {
      await pipelinesService.moveItemToPipeline({
        item_id: item.id,
        pipeline_id: currentPipelineId,
        target_pipeline_id: String(selectedPipeline.id),
        to_stage_id: stageId,
        notes,
      });
      onMoved({ pipelineId: String(selectedPipeline.id), pipelineName: selectedPipeline.name, samePipeline });
      onOpenChange(false);
    } catch (err) {
      setError(apiErrorMessage(err) || t('moveItem.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('moveItem.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('moveItem.pipeline')}</Label>
            <div className="flex flex-wrap gap-2">
              {pipelines.map(p => (
                <Button
                  key={p.id}
                  type="button"
                  size="sm"
                  variant={String(p.id) === String(pipelineId) ? 'default' : 'outline'}
                  data-testid={`move-pipeline-${p.id}`}
                  onClick={() => {
                    setPipelineId(String(p.id));
                    setStageId(null);
                  }}
                >
                  {p.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('moveItem.stage')}</Label>
            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
              {(selectedPipeline?.stages || []).map(stage => {
                const isCurrent = samePipeline && String(stage.id) === String(item?.stage_id);
                return (
                  <Button
                    key={stage.id}
                    type="button"
                    size="sm"
                    variant={String(stage.id) === stageId ? 'default' : 'ghost'}
                    className="justify-start"
                    disabled={isCurrent}
                    data-testid={`move-stage-${stage.id}`}
                    onClick={() => setStageId(String(stage.id))}
                  >
                    <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: stage.color }} />
                    {stage.name}
                    {isCurrent && <span className="ml-2 text-xs text-muted-foreground">({t('moveItem.current')})</span>}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="move-notes">{t('moveItem.notes')}</Label>
            <Textarea id="move-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          {(error || loadFailed) && (
            <p className="text-sm text-destructive">{error || t('moveItem.loadError')}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('moveItem.cancel')}
          </Button>
          <Button data-testid="move-submit" onClick={handleSubmit} disabled={!stageId || saving}>
            {t('moveItem.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
