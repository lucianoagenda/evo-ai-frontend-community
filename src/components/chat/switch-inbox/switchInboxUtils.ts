// [Traggi] Regras compartilhadas da troca de WhatsApp de saída.
import type { Inbox } from '@/types/channels/inbox';

const UNAVAILABLE_STATES = ['disconnected', 'error'];

export const whatsappInboxes = (inboxes: Inbox[]): Inbox[] =>
  inboxes.filter(inbox => inbox.channel_type === 'Channel::Whatsapp');

export const isInboxUnavailable = (inbox?: Inbox | null): boolean =>
  !!inbox?.connection_state && UNAVAILABLE_STATES.includes(inbox.connection_state);
