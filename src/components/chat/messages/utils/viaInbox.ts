// [Traggi] Nome do número por onde a mensagem passou, quando difere do número atual da conversa.
export const viaInboxName = (
  messageInboxId: string | undefined,
  currentInboxId: string | undefined,
  inboxNames: Map<string, string>,
): string | null => {
  if (!messageInboxId || !currentInboxId || messageInboxId === currentInboxId) return null;
  return inboxNames.get(messageInboxId) ?? null;
};
