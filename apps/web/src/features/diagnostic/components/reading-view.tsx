import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  type FicheColisPhoto,
  LectureScreen,
  type LectureScreenProps,
  PhotoViewer,
  Screen,
} from '@repo/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '#/features/db/database';
import type { ExtractionFieldName } from '#/features/db/schema';
import { diagnosticText } from '#/features/diagnostic/copy';
import { loadReading, type NoReading } from '#/features/diagnostic/load';
import { describeReading, fieldAnchor } from '#/features/diagnostic/model';
import {
  type PhotoUrl,
  usePhotoUrl,
} from '#/features/parcels/api/parcel-record';

const t = createTranslator(DEFAULT_LOCALE);

const EMPTY: Record<NoReading, LectureScreenProps['empty']> = {
  never: {
    icon: 'scan',
    title: t('reading.empty.never.title'),
    description: t('reading.empty.never.description'),
  },
  purged: {
    icon: 'clock',
    title: t('reading.empty.purged.title'),
    description: t('reading.empty.purged.description'),
  },
  elsewhere: {
    icon: 'phone',
    title: t('reading.empty.elsewhere.title'),
    description: t('reading.empty.elsewhere.description'),
  },
  missing: { icon: 'package', title: t('reading.empty.missing.title') },
};

function photoOf(url: PhotoUrl, onOpen: () => void): FicheColisPhoto {
  switch (url.state) {
    case 'loading':
      return { loading: true };
    case 'absent':
      return { absent: t('record.photo.absent') };
    case 'ready':
      return { src: url.url, alt: t('record.photo.alt'), onOpen };
  }
}

type Copy = 'idle' | 'done' | 'failed';

/**
 * « Voir ce qui a été lu » (F22) for a parcel or a draft of the batch:
 * read on the iPhone, copied as text for support. `field` scrolls to the
 * card of the field the agent asked about.
 */
export function ReadingView({
  id,
  field,
  onBack,
}: {
  id: string;
  field?: ExtractionFieldName;
  onBack: () => void;
}) {
  const reading = useLiveQuery(() => loadReading(db, id), [id]);
  const photoId =
    reading === undefined
      ? undefined
      : reading.kind === 'none'
        ? null
        : reading.photoId;
  const photoUrl = usePhotoUrl(photoId);
  const [viewing, setViewing] = useState(false);
  const [copy, setCopy] = useState<Copy>('idle');

  useEffect(() => {
    if (copy !== 'done') return;
    const timer = setTimeout(() => setCopy('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copy]);

  if (reading === undefined) return <Screen tone="fill">{null}</Screen>;
  const now = new Date();
  const view = describeReading(reading, { t, now });
  if (view.kind === 'empty') {
    return (
      <LectureScreen
        title={t('reading.title')}
        empty={EMPTY[view.reason]}
        onBack={onBack}
      />
    );
  }
  const extraction = reading.kind === 'none' ? null : reading.extraction;

  const onCopy = async () => {
    if (!extraction) return;
    try {
      await navigator.clipboard.writeText(
        diagnosticText(extraction, { t, now }),
      );
      setCopy('done');
    } catch {
      setCopy('failed');
    }
  };

  return (
    <LectureScreen
      title={t('reading.title')}
      subtitle={view.subtitle}
      photo={
        reading.kind === 'draft' && reading.photoId === null
          ? undefined
          : photoOf(photoUrl, () => setViewing(true))
      }
      fields={view.fields}
      codes={view.codes}
      lines={view.lines}
      facts={view.facts}
      focus={field ? fieldAnchor(field) : undefined}
      copy={{
        label: t('reading.copy'),
        onClick: () => void onCopy(),
        done: copy === 'done' ? t('reading.copy.done') : undefined,
        failed: copy === 'failed' ? t('reading.copy.failed') : undefined,
      }}
      onBack={onBack}
      overlay={
        viewing &&
        photoUrl.state === 'ready' && (
          <PhotoViewer
            src={photoUrl.url}
            alt={t('record.photo.alt')}
            closeLabel={t('record.photo.close')}
            onClose={() => setViewing(false)}
          />
        )
      }
    />
  );
}
