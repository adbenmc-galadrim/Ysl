import type { ReactNode } from 'react';

import { Field, FieldInput, FieldSelect } from '#components/field';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { cn } from '#lib/tv';

const BOX = 'h-12 rounded-[12px] bg-surface pr-3.5 pl-3.5 font-normal';

function FormField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  return (
    <Field
      label={label}
      className={cn('[&>label]:relative [&>label]:-top-px', className)}
    >
      {children}
    </Field>
  );
}

const Picker = ({ id, value }: { id: string; value: string }) => (
  <FieldSelect id={id} value={value} className={cn(BOX, '[&>svg]:rotate-90')} />
);

/** The shuttle corrects a parcel: its department follows the recipient. */
export function NavetteModifierMobile() {
  return (
    <Screen tone="fill">
      <NavBar
        leading={<NavBarAction className="font-normal">Annuler</NavBarAction>}
        title="Modifier le colis"
        trailing={<NavBarAction>Enregistrer</NavBarAction>}
      />
      <FormField label="Destinataire" className="mt-4">
        {(id) => <Picker id={id} value="Camille Morel" />}
      </FormField>
      <FormField label="Département" className="mt-4">
        {(id) => <Picker id={id} value="Studio" />}
      </FormField>
      <p className="relative -top-px mt-1.5 h-4 text-13 text-muted">
        Pris du destinataire. Le changer envoie le colis ailleurs.
      </p>
      <FormField label="Numéro de suivi" className="mt-4">
        {(id) => (
          <FieldInput
            id={id}
            mono
            readOnly
            value="1Z E63 44W 04 9923 0622"
            className={BOX}
          />
        )}
      </FormField>
      <FormField label="Transporteur" className="mt-4">
        {(id) => <Picker id={id} value="UPS" />}
      </FormField>
      <FormField label="Note" className="mt-4">
        {(id) => (
          <FieldInput id={id} placeholder="Ajouter une note" className={BOX} />
        )}
      </FormField>
    </Screen>
  );
}
