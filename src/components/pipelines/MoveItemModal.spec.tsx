import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MoveItemModal from './MoveItemModal';
import { pipelinesService } from '@/services/pipelines';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key, currentLanguage: 'pt-BR' }),
}));
vi.mock('@/services/pipelines', () => ({
  pipelinesService: { getPipelines: vi.fn(), moveItemToPipeline: vi.fn() },
}));

const pipelines = [
  {
    id: 'p1',
    name: 'Vendas',
    is_active: true,
    stages: [
      { id: 's1', name: 'Novo', color: '#111' },
      { id: 's2', name: 'Proposta', color: '#222' },
    ],
  },
  { id: 'p2', name: 'Pós-venda', is_active: true, stages: [{ id: 's3', name: 'Onboarding', color: '#333' }] },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const item = { id: 'i1', stage_id: 's1', pipeline_id: 'p1' } as any;

describe('MoveItemModal', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(pipelinesService.getPipelines).mockResolvedValue({ data: pipelines } as any);
    vi.mocked(pipelinesService.moveItemToPipeline).mockResolvedValue({});
  });

  it('lists only stages of the selected pipeline and disables the current stage', async () => {
    render(<MoveItemModal open onOpenChange={vi.fn()} item={item} currentPipelineId="p1" onMoved={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId('move-stage-s2')).toBeInTheDocument());
    expect(screen.getByTestId('move-stage-s1')).toBeDisabled();
    expect(screen.queryByTestId('move-stage-s3')).not.toBeInTheDocument();
  });

  it('moves to a stage of another pipeline and reports the target', async () => {
    const onMoved = vi.fn();
    render(<MoveItemModal open onOpenChange={vi.fn()} item={item} currentPipelineId="p1" onMoved={onMoved} />);

    await waitFor(() => screen.getByTestId('move-pipeline-p2'));
    fireEvent.click(screen.getByTestId('move-pipeline-p2'));
    fireEvent.click(await screen.findByTestId('move-stage-s3'));
    fireEvent.click(screen.getByTestId('move-submit'));

    await waitFor(() =>
      expect(pipelinesService.moveItemToPipeline).toHaveBeenCalledWith({
        item_id: 'i1',
        pipeline_id: 'p1',
        target_pipeline_id: 'p2',
        to_stage_id: 's3',
        notes: '',
      }),
    );
    expect(onMoved).toHaveBeenCalledWith({ pipelineId: 'p2', pipelineName: 'Pós-venda', samePipeline: false });
  });

  it('shows the backend conflict message', async () => {
    vi.mocked(pipelinesService.moveItemToPipeline).mockRejectedValue({
      response: {
        status: 422,
        data: { error: { message: "Item already has an active journey in this pipeline in stage 'Onboarding'" } },
      },
    });
    render(<MoveItemModal open onOpenChange={vi.fn()} item={item} currentPipelineId="p1" onMoved={vi.fn()} />);

    await waitFor(() => screen.getByTestId('move-pipeline-p2'));
    fireEvent.click(screen.getByTestId('move-pipeline-p2'));
    fireEvent.click(await screen.findByTestId('move-stage-s3'));
    fireEvent.click(screen.getByTestId('move-submit'));

    expect(await screen.findByText(/already has an active journey/)).toBeInTheDocument();
  });
});
