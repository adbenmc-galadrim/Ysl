import { PICKUP_PIN_LENGTH } from '@repo/contract/pickup';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { RemiseCodeScreen } from '@repo/ui';
import { useEffect, useRef, useState } from 'react';
import { db } from '#/features/db/database';
import {
  elsewhereLines,
  lookupPickupPin,
} from '#/features/handover/pickup-lookup';
import {
  pinLockLeft,
  pinOutcome,
  readPinAttempts,
  writePinAttempts,
} from '#/features/handover/pin-attempts';
import {
  type RemiseColisSearch,
  searchForCode,
} from '#/features/handover/route';
import { serverCheck } from '#/features/handover/server-check';

const t = createTranslator(DEFAULT_LOCALE);

export type RemiseCodePageProps = {
  onFound: (search: RemiseColisSearch) => void;
  onBack: () => void;
  onSearchName?: () => void;
};

/**
 * The PIN said aloud, checked against the hashes on this iPhone at the
 * last digit. Five wrong ones in a row and the pad waits 30 s: four
 * digits are guessed fast (§8.7).
 */
export function RemiseCodePage({
  onFound,
  onBack,
  onSearchName,
}: RemiseCodePageProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [elsewhere, setElsewhere] =
    useState<ReturnType<typeof elsewhereLines>>();
  const [attempts, setAttempts] = useState(readPinAttempts);
  const [clock, setClock] = useState(Date.now);
  const checking = useRef(false);

  const left = pinLockLeft(attempts, clock);
  const waiting = left > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  const record = (next: typeof attempts) => {
    writePinAttempts(next);
    setAttempts(next);
    setClock(Date.now());
  };

  const check = async (pin: string) => {
    checking.current = true;
    try {
      const match = await lookupPickupPin(db, pin, new Date(), serverCheck);
      record(pinOutcome(attempts, match.status, Date.now()));
      if (match.status === 'active') {
        onFound(searchForCode(match.code, 'pin', Date.now()));
        return;
      }
      if (match.status === 'other_department') {
        setElsewhere(elsewhereLines(match.elsewhere, 'pin', t));
      } else setError(t(`handover.pin.${match.status}`));
      setCode('');
    } finally {
      checking.current = false;
    }
  };

  const onDigit = (digit: string) => {
    if (checking.current || pinLockLeft(attempts, Date.now()) > 0) return;
    if (code.length >= PICKUP_PIN_LENGTH) return;
    const next = code + digit;
    setError(undefined);
    setElsewhere(undefined);
    setCode(next);
    if (next.length === PICKUP_PIN_LENGTH) void check(next);
  };

  return (
    <RemiseCodeScreen
      code={code}
      length={PICKUP_PIN_LENGTH}
      error={error}
      elsewhere={elsewhere}
      locked={
        waiting
          ? t('handover.pin.locked', { seconds: Math.ceil(left / 1000) })
          : undefined
      }
      onDigit={onDigit}
      onDelete={() => {
        if (checking.current) return;
        setError(undefined);
        setElsewhere(undefined);
        setCode((typed) => typed.slice(0, -1));
      }}
      onBack={onBack}
      onSearchName={onSearchName}
    />
  );
}
