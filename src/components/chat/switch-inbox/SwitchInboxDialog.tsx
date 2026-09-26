// [Traggi] Escolhe outro WhatsApp para a conversa. O histórico continua na mesma conversa/card.
import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogFooter, DialogTitle } from '@evoapi/design-system';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';
import { useAppDataStore } from '@/store/appDataStore';
import chatService from '@/services/chat/chatService';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { Conversation } from '@/types/chat/api';
import { isInboxUnavailable, whatsappInboxes } from './switchInboxUtils';

interface SwitchInboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  currentInboxId: string;
  onSwitched: (conversation: Conversation) => void;
}

export default function SwitchInboxDialog({
  open,
  onOpenChange,
  conversationId,
  currentInboxId,
  onSwitched,
}: SwitchInboxDialogProps) {
  const { t } = useLanguage('chat');
  const { inboxes } = useAppDataStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const options = whatsappInboxes(inboxes);
  const selected = options.find(i => i.id === selectedId);

  const close = (value: boolean) => {
    if (!value) setSelectedId(null);
    onOpenChange(value);
  };

  const confirm = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const response = await chatService.switchInbox(conversationId, selectedId);
      onSwitched(response.data);
      toast.success(t('switchInbox.success', { name: selected?.name }));
      close(false);
    } catch (err) {
      toast.error(apiErrorMessage(err) || t('switchInbox.error'));
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (isCurrent: boolean, unavailable: boolean) => {
    if (isCurrent) return t('switchInbox.current');
    return unavailable ? t('switchInbox.disconnected') : t('switchInbox.connected');
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>{t('switchInbox.title')}</DialogTitle>

        {!selected ? (
          <div className="flex flex-col gap-1">
            {options.map(inbox => {
              const isCurrent = inbox.id === currentInboxId;
              const unavailable = isInboxUnavailable(inbox);
              return (
                <Button
                  key={inbox.id}
                  type="button"
                  variant="ghost"
                  className="justify-between"
                  disabled={isCurrent || unavailable}
                  data-testid={`switch-inbox-${inbox.id}`}
                  onClick={() => setSelectedId(inbox.id)}
                >
                  <span>
                    {inbox.name}
                    {inbox.phone_number && (
                      <span className="ml-2 text-xs text-muted-foreground">{inbox.phone_number}</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{statusLabel(isCurrent, unavailable)}</span>
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm">{t('switchInbox.confirmText', { name: selected.name })}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => (selected ? setSelectedId(null) : close(false))} disabled={saving}>
            {selected ? t('switchInbox.back') : t('switchInbox.cancel')}
          </Button>
          {selected && (
            <Button data-testid="switch-inbox-confirm" onClick={confirm} disabled={saving}>
              {t('switchInbox.confirm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
