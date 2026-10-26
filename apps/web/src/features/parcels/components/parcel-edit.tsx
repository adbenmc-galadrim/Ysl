import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  type ModifierColisErrors,
  ModifierColisScreen,
  type ModifierColisValues,
  Screen,
} from '@repo/ui';
import { Navigate, useNavigate, useRouter } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { fullName } from '#/features/directory/people';
import { useParcelRecord } from '#/features/parcels/api/parcel-record';
import {
  RecipientPicker,
  type PickedRecipient,
} from '#/features/parcels/components/recipient-picker';
import {
  editOf,
  type EditErrors,
  type ParcelEdit,
  saveParcelEdit,
} from '#/features/parcels/edit';
import type { ParcelRecord } from '#/features/parcels/record';
import { formatTracking } from '#/features/parcels/record';
import {
  carrierOptions,
  checkTracking,
} from '#/features/parcels/tracking-check';

const t = createTranslator(DEFAULT_LOCALE);

const CARRIERS = carrierOptions(t);

type Form = {
  values: ModifierColisValues;
  recipient: PickedRecipient;
};

function formOf({ parcel, person, contact }: ParcelRecord): Form {
  const edit = editOf(parcel);
  return {
    values: {
      tracking: edit.tracking ? formatTracking(edit.tracking) : '',
      carrier: edit.carrier,
      sender: edit.sender,
      pieces: edit.pieceTotal,
      piecesReceived: edit.pieceN,
      note: edit.notes,
      email: edit.notificationEmail,
      service: edit.carrierService,
      reference: edit.reference,
      weight: edit.weightKg,
      location: edit.location,
    },
    recipient: {
      choice: edit.recipient,
      label: person
        ? [fullName(person), person.department].filter(Boolean).join(', ')
        : (contact?.name ?? ''),
    },
  };
}

function editFrom({ values, recipient }: Form): ParcelEdit {
  return {
    recipient: recipient.choice,
    tracking: values.tracking,
    carrier: values.carrier,
    sender: values.sender,
    pieceTotal: values.pieces,
    pieceN: values.piecesReceived,
    notes: values.note,
    notificationEmail: values.email,
    carrierService: values.service,
    reference: values.reference,
    weightKg: values.weight,
    location: values.location,
  };
}

function errorsOf(errors: EditErrors): ModifierColisErrors {
  return {
    ...(errors.recipient && { recipient: t(`edit.error.${errors.recipient}`) }),
    ...(errors.email && { email: t(`edit.error.${errors.email}`) }),
    ...(errors.weight && { weight: t(`edit.error.${errors.weight}`) }),
  };
}

function EditForm({ record }: { record: ParcelRecord }) {
  const navigate = useNavigate();
  const router = useRouter();
  const session = useSession();
  const { parcel } = record;
  const [form, setForm] = useState<Form>(() => formOf(record));
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<EditErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const check = useMemo(
    () => checkTracking(form.values.tracking, form.values.carrier, t),
    [form.values.tracking, form.values.carrier],
  );

  const leave = () => {
    if (router.history.canGoBack()) router.history.back();
    else
      void navigate({
        to: '/colis/$parcelId',
        params: { parcelId: parcel.id },
      });
  };

  const onChange = (values: ModifierColisValues) => {
    const suggested =
      values.tracking !== form.values.tracking && !values.carrier
        ? checkTracking(values.tracking, '', t).carrier
        : undefined;
    setForm({
      ...form,
      values: suggested ? { ...values, carrier: suggested } : values,
    });
    setErrors({});
    setFailure(null);
  };

  const onSave = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setFailure(null);
    try {
      const result = await saveParcelEdit(db, parcel.id, editFrom(form), {
        agentId: session.user.id,
      });
      if (result.kind === 'invalid') {
        setErrors(result.errors);
        if (result.errors.pieces) {
          setFailure(t(`edit.error.${result.errors.pieces}`));
        }
      } else {
        leave();
      }
    } catch {
      setFailure(t('edit.failed'));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <ModifierColisScreen
        recipient={form.recipient.label}
        values={form.values}
        onChange={onChange}
        carriers={CARRIERS}
        trackingCheck={check.check}
        errors={errorsOf(errors)}
        failure={failure}
        saving={saving}
        onRecipientClick={() => setPicking(true)}
        onCancel={leave}
        onSave={() => void onSave()}
      />
      {picking && (
        <RecipientPicker
          readName={parcel.readName}
          onClear={
            form.recipient.choice.kind === 'none'
              ? undefined
              : () => {
                  setForm({
                    ...form,
                    recipient: { choice: { kind: 'none' }, label: '' },
                  });
                  setPicking(false);
                }
          }
          onPick={(recipient) => {
            setForm({ ...form, recipient });
            setErrors({});
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

/** « Modifier le colis » (F29): every field of the record, saved on the iPhone first. */
export function ParcelEditView({ parcelId }: { parcelId: string }) {
  const record = useParcelRecord(parcelId);
  if (record === undefined) return <Screen>{null}</Screen>;
  if (record === null) {
    return <Navigate to="/colis/$parcelId" params={{ parcelId }} replace />;
  }
  return <EditForm record={record} />;
}
