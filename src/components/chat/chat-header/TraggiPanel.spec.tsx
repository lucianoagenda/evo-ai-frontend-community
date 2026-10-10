/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TraggiPanel from './TraggiPanel';
import { getTraggiSituacao, executarTraggiAcao } from '@/services/traggi/traggiService';
import { toast } from 'sonner';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key, currentLanguage: 'pt-BR' }),
}));
vi.mock('@/services/traggi/traggiService', () => ({ getTraggiSituacao: vi.fn(), executarTraggiAcao: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const lead = {
  configured: true,
  tipo: 'lead',
  id: 12,
  status: 'com_time',
  status_rotulo: 'Com o time',
  nome: 'Joana',
  ia_respondendo: false,
  opt_out: false,
  resumo: 'Quer demonstração.',
  motivo: 'quer demonstração',
  acoes: ['devolver', 'encerrar', 'opt_out'],
  motivos: [],
  link: 'https://traggi.test/admin/agente/lead/12',
};

const cliente = {
  ...lead,
  tipo: 'cliente',
  id: 7,
  status: 'atendimento_humano',
  status_rotulo: 'Atendimento humano',
  acoes: ['devolver', 'encerrar', 'opt_out'],
  motivos: [
    { chave: 'preco', rotulo: 'Preço' },
    { chave: 'outro', rotulo: 'Outro' },
  ],
  link: 'https://traggi.test/admin/agente/abordagem/7',
};

describe('TraggiPanel', () => {
  beforeEach(() => {
    vi.mocked(getTraggiSituacao).mockReset();
    vi.mocked(executarTraggiAcao).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('renders nothing when the Traggi is not configured', async () => {
    vi.mocked(getTraggiSituacao).mockResolvedValue({ configured: false } as any);
    const { container } = render(<TraggiPanel conversationId="c1" />);

    await waitFor(() => expect(getTraggiSituacao).toHaveBeenCalledWith('c1'));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the phone is unknown to the agent', async () => {
    vi.mocked(getTraggiSituacao).mockResolvedValue({ configured: true, tipo: 'nenhum', acoes: [], motivos: [] } as any);
    const { container } = render(<TraggiPanel conversationId="c1" />);

    await waitFor(() => expect(getTraggiSituacao).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing (and does not crash) when loading fails', async () => {
    vi.mocked(getTraggiSituacao).mockRejectedValue(new Error('offline'));
    const { container } = render(<TraggiPanel conversationId="c1" />);

    await waitFor(() => expect(getTraggiSituacao).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the situation and only the allowed buttons', async () => {
    vi.mocked(getTraggiSituacao).mockResolvedValue({ ...lead, acoes: ['encerrar', 'opt_out'] } as any);
    render(<TraggiPanel conversationId="c1" />);

    expect(await screen.findByText('Com o time')).toBeInTheDocument();
    expect(screen.getByText('traggiPanel.tipo.lead')).toBeInTheDocument();
    // Status da IA, motivo e resumo ficam no tooltip do ícone (o header não tem espaço).
    const ia = screen.getByTestId('traggi-ia');
    expect(ia).toHaveAttribute('aria-label', 'traggiPanel.iaSilenciosa');
    expect(ia.getAttribute('title')).toContain('Quer demonstração.');
    expect(ia.getAttribute('title')).toContain('traggiPanel.motivo: quer demonstração');
    expect(screen.getByRole('link', { name: /traggiPanel.abrirNoTraggi/ })).toHaveAttribute('href', lead.link);
    expect(screen.queryByTestId('traggi-acao-devolver')).not.toBeInTheDocument();
    expect(screen.getByTestId('traggi-acao-encerrar')).toBeInTheDocument();
    expect(screen.getByTestId('traggi-acao-opt_out')).toBeInTheDocument();
  });

  it('asks for confirmation before running an action, then shows the new situation', async () => {
    vi.mocked(getTraggiSituacao).mockResolvedValue(lead as any);
    vi.mocked(executarTraggiAcao).mockResolvedValue({
      ...lead,
      status: 'em_conversa',
      status_rotulo: 'Em conversa',
      ia_respondendo: true,
      acoes: ['encerrar', 'opt_out'],
    } as any);
    render(<TraggiPanel conversationId="c1" />);

    fireEvent.click(await screen.findByTestId('traggi-acao-devolver'));
    expect(executarTraggiAcao).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('traggi-confirmar'));

    await waitFor(() =>
      expect(executarTraggiAcao).toHaveBeenCalledWith('c1', { tipo: 'lead', id: 12, acao: 'devolver' }),
    );
    expect(await screen.findByText('Em conversa')).toBeInTheDocument();
    expect(screen.getByTestId('traggi-ia')).toHaveAttribute('aria-label', 'traggiPanel.iaRespondendo');
    expect(toast.success).toHaveBeenCalledWith('traggiPanel.sucesso.devolver');
  });

  it('sends the note and the reason when closing a customer', async () => {
    vi.mocked(getTraggiSituacao).mockResolvedValue(cliente as any);
    vi.mocked(executarTraggiAcao).mockResolvedValue({ ...cliente, status: 'encerrado', acoes: ['reabrir', 'opt_out'] } as any);
    render(<TraggiPanel conversationId="c1" />);

    fireEvent.click(await screen.findByTestId('traggi-acao-encerrar'));
    fireEvent.change(screen.getByTestId('traggi-motivo'), { target: { value: 'preco' } });
    fireEvent.change(screen.getByTestId('traggi-observacao'), { target: { value: 'Achou caro' } });
    fireEvent.click(screen.getByTestId('traggi-confirmar'));

    await waitFor(() =>
      expect(executarTraggiAcao).toHaveBeenCalledWith('c1', {
        tipo: 'cliente',
        id: 7,
        acao: 'encerrar',
        observacao: 'Achou caro',
        motivo_categoria: 'preco',
      }),
    );
  });

  it('does not offer a reason when closing a lead', async () => {
    vi.mocked(getTraggiSituacao).mockResolvedValue(lead as any);
    render(<TraggiPanel conversationId="c1" />);

    fireEvent.click(await screen.findByTestId('traggi-acao-encerrar'));
    expect(screen.queryByTestId('traggi-motivo')).not.toBeInTheDocument();
    expect(screen.getByTestId('traggi-observacao')).toBeInTheDocument();
  });

  it('shows the Traggi refusal message', async () => {
    vi.mocked(getTraggiSituacao).mockResolvedValue(lead as any);
    vi.mocked(executarTraggiAcao).mockRejectedValue({
      response: { status: 422, data: { error: { message: 'Essa ação não vale para a situação atual.' } } },
    });
    render(<TraggiPanel conversationId="c1" />);

    fireEvent.click(await screen.findByTestId('traggi-acao-devolver'));
    fireEvent.click(screen.getByTestId('traggi-confirmar'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Essa ação não vale para a situação atual.'));
  });

  it('reloads when the conversation changes', async () => {
    vi.mocked(getTraggiSituacao).mockResolvedValue(lead as any);
    const { rerender } = render(<TraggiPanel conversationId="c1" />);
    await waitFor(() => expect(getTraggiSituacao).toHaveBeenCalledWith('c1'));

    rerender(<TraggiPanel conversationId="c2" />);

    await waitFor(() => expect(getTraggiSituacao).toHaveBeenCalledWith('c2'));
  });
});
