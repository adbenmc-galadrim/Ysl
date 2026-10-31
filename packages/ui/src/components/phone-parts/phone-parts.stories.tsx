import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  KraftThumb,
  PersonAvatar,
  PhoneBanner,
  PhoneField,
  PhoneGroup,
  PhoneGroupTitle,
  PhoneRow,
  PhoneSection,
  PhoneSegments,
  PhoneSettingRow,
  PhoneStat,
  RoundTile,
  TickMark,
} from '#components/phone-parts';

const meta = {
  title: 'Composants/PhoneParts',
  decorators: [
    (Story) => (
      <div className="flex w-[353px] flex-col gap-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Lignes: Story = {
  name: 'Lignes de liste',
  render: () => (
    <div>
      <PhoneSection title="À remettre" count={3} />
      <PhoneRow leading={<KraftThumb />} title="Amazon ···4471" lines={['À retirer']} separator />
      <PhoneRow
        leading={<PersonAvatar initials="CM" />}
        title="Camille Morel"
        lines={['UPS ···0622', 'Prévenue à 10:58']}
        separator
      />
      <PhoneRow
        leading={<RoundTile icon="building" />}
        title="Studio"
        lines={['2e étage']}
        height={72}
        before={<span className="text-17 font-semibold">4</span>}
        separator
      />
      <PhoneRow leading={<KraftThumb />} title="UPS ···8810" lines={['Scanné']} mark={<TickMark />} />
    </div>
  ),
};

export const Reglages: Story = {
  name: 'Lignes de réglages',
  render: () => (
    <div className="bg-fill p-5">
      <PhoneGroupTitle>Domaine</PhoneGroupTitle>
      <PhoneGroup className="mt-1.5">
        <PhoneSettingRow
          icon={{ name: 'send', tone: 'ink' }}
          title="Expéditeur"
          value="courrier@…"
          separator
        />
        <PhoneSettingRow icon={{ name: 'shield', tone: 'green' }} title="Conservation" value="12 mois" />
      </PhoneGroup>
    </div>
  ),
};

export const Formulaire: Story = {
  render: () => (
    <div className="flex flex-col gap-4 bg-fill p-5">
      <PhoneField label="Prénom et nom" value="Nadia Kessler" />
      <PhoneField label="Département" value="Finance" chevron />
      <PhoneField label="E-mail" value="nadia@" error />
      <PhoneField label="Mot de passe" type="password" value="motdepasse12" />
      <PhoneSegments
        label="Rôle"
        options={['Navette', 'Département']}
        value="Navette"
        className="h-9 rounded-[10px]"
        optionClassName="rounded-[8px] text-13"
      />
    </div>
  ),
};

export const Chiffres: Story = {
  name: 'Chiffres et bandeau',
  render: () => (
    <div className="flex flex-col gap-3 bg-fill p-5">
      <PhoneStat label="En souffrance" value="5" tone="orange" />
      <PhoneBanner
        icon="info"
        title="Colis à vérifier"
        description="Une seule ligne de description."
        height={67}
      />
    </div>
  ),
};
