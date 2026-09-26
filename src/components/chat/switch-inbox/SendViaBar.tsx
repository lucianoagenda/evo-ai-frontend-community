// [Traggi] "Enviar por: <número>" acima do campo de mensagem + aviso de número desconectado.
import { useState } from 'react';
import { Button } from '@evoapi/design-system';
import { AlertTriangle, Smartphone } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { useAppDataStore } from '@/store/appDataStore';
import type { Conversation } from '@/types/chat/api';
import SwitchInboxDialog from './SwitchInboxDialog';
import { isInboxUnavailable, whatsappInboxes } from './switchInboxUtils';

interface SendViaBarProps {
  conversationId: string;
  currentInboxId: string;
  isWhatsApp: boolean;
  onSwitched: (conversation: Conversation) => void;
}

export default function SendViaBar({ conversationId, currentInboxId, isWhatsApp, onSwitched }: SendViaBarProps) {
  const { t } = useLanguage('chat');
  const { inboxes } = useAppDataStore();
  const [open, setOpen] = useState(false);
  const options = whatsappInboxes(inboxes);
  const current = options.find(i => i.id === currentInboxId);

  if (!isWhatsApp || options.length < 2) return null;

  const unavailable = isInboxUnavailable(current);

  return (
    <>
      <div
        className={`flex items-center gap-2 px-4 py-1.5 text-xs border-t border-border ${
          unavailable ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200' : 'text-muted-foreground'
        }`}
      >
        {unavailable ? <AlertTriangle className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
        {unavailable && <span>{t('switchInbox.disconnectedBanner')}</span>}
        <span>{t('switchInbox.sendVia')}</span>
        <span className="font-medium text-foreground">{current?.name}</span>
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setOpen(true)}>
          {unavailable ? t('switchInbox.disconnectedAction') : t('switchInbox.change')}
        </Button>
      </div>
      <SwitchInboxDialog
        open={open}
        onOpenChange={setOpen}
        conversationId={conversationId}
        currentInboxId={currentInboxId}
        onSwitched={onSwitched}
      />
    </>
  );
}
