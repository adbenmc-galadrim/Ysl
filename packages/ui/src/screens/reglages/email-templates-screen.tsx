import {
  GroupedRow,
  GroupedSection,
  SettingsIcon,
} from '#components/grouped-list';
import { NavBarAction } from '#components/nav-bar';
import { SettingsScreen } from '#screens/reglages/settings-screen';

export type EmailTemplateItem = {
  id: string;
  name: string;
  subject: string;
  /** The template every mail starts from: restored, never deleted. */
  isDefault?: boolean;
};

export type EmailTemplatesScreenProps = {
  templates: EmailTemplateItem[];
  onOpen?: (id: string) => void;
  onCreate?: () => void;
  /** Why the last write did not go through; shown under the list. */
  error?: string;
  onBack?: () => void;
};

/**
 * The agent's own e-mail templates (D2): each one an object and a body with
 * variables, opened in the iPhone's mail app from the agent's own address.
 * No mockup draws this list; it takes the frame of the Réglages screens.
 */
export function EmailTemplatesScreen({
  templates,
  onOpen,
  onCreate,
  error,
  onBack,
}: EmailTemplatesScreenProps) {
  return (
    <SettingsScreen
      title="Modèles d’e-mail"
      onBack={onBack}
      trailing={
        onCreate && <NavBarAction onClick={onCreate}>Nouveau</NavBarAction>
      }
      className="mt-4"
    >
      <GroupedSection
        header="Mes modèles"
        footer="Vos e-mails partent de votre adresse, par la messagerie de l’iPhone. Vos modèles vous suivent sur vos autres appareils."
      >
        {templates.map((template) => (
          <GroupedRow
            key={template.id}
            leading={<SettingsIcon icon="mail" color="blue" />}
            title={template.name}
            subtitle={template.subject || 'Sans objet'}
            value={template.isDefault ? 'Par défaut' : undefined}
            accessory="chevron"
            onClick={onOpen && (() => onOpen(template.id))}
          />
        ))}
      </GroupedSection>
      {error && (
        <p role="alert" className="px-4 text-13 leading-[1.4] text-red">
          {error}
        </p>
      )}
    </SettingsScreen>
  );
}
