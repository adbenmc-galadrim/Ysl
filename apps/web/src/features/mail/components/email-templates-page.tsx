import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { EmailTemplatesScreen } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { createTemplate, listTemplates } from '#/features/mail/templates';

const t = createTranslator(DEFAULT_LOCALE);

/** Réglages › Modèles d'e-mail: the agent's own templates, read offline. */
export function EmailTemplatesPage() {
  const navigate = useNavigate();
  const userId = useSession().user.id;
  const [failed, setFailed] = useState(false);
  const templates = useLiveQuery(() => listTemplates(db, userId), [userId]);
  if (!templates) return null;

  const open = (templateId: string) =>
    void navigate({
      to: '/reglages/modeles-email/$templateId',
      params: { templateId },
    });

  return (
    <EmailTemplatesScreen
      templates={templates}
      onOpen={open}
      onCreate={() =>
        void createTemplate(db, t('mail.template.newName'), { userId })
          .then((created) => open(created.id))
          .catch(() => setFailed(true))
      }
      error={failed ? t('mail.template.saveFailed') : undefined}
      onBack={() => void navigate({ to: '/reglages' })}
    />
  );
}
