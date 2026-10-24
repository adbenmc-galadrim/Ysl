import { EOT, GS, RS, US } from '@repo/contract/codes';
import { recipientAddress } from '#synthetic/identities';
import type { Planned } from '#synthetic/plan';

const HEADER = `[)>${RS}01${GS}`;

const KG_PER_POUND = 0.45359237;

const pieces = (p: Planned) =>
  `${String(p.pieces.index).padStart(3, '0')}/${String(p.pieces.total).padStart(3, '0')}`;

const kilograms = (p: Planned) => `${p.weightKg.toFixed(2).padStart(5, '0')}KG`;

const julianDay = (p: Planned) => String((p.seed % 365) + 1).padStart(3, '0');

const phone = (p: Planned) =>
  `+336${String(p.seed % 100000000).padStart(8, '0')}`;

const geopostTail = (p: Planned) =>
  `${RS}07${GS}G03${GS}0${GS}0${GS}0${GS}${US}${US}${phone(p)}${US}${US}F~${recipientAddress.postcode}${US}${EOT}`;

const geopostAztec = (
  p: Planned,
  service: string,
  tracking: string,
  network: 'GEOP' | 'CHRO',
) =>
  HEADER +
  [
    '02',
    network === 'GEOP' && p.carrier === 'colissimo'
      ? `00${recipientAddress.postcode}`
      : recipientAddress.postcode,
    '250',
    service,
    tracking,
    network,
    String(100000 + (p.seed % 900000)),
    '',
    '',
    pieces(p),
    kilograms(p),
    'N',
    recipientAddress.street,
    recipientAddress.city,
    '',
    p.recipient.toUpperCase(),
  ].join(GS) +
  GS +
  geopostTail(p);

export const colissimoAztec = (p: Planned) =>
  geopostAztec(p, '801', `11${p.tracking.value.slice(0, 12)}`, 'GEOP');

export const chronopostAztec = (p: Planned) =>
  geopostAztec(p, '925', p.tracking.value, 'CHRO');

export const dpdAztec = (p: Planned) =>
  geopostAztec(p, '328', p.tracking.value, 'GEOP');

export const fedexPdf417 = (p: Planned) =>
  HEADER +
  [
    `02${recipientAddress.postcode}`,
    '250',
    '020',
    p.tracking.value,
    'FDE',
    String(100000000 + (p.seed % 900000000)),
    julianDay(p),
    '',
    `${p.pieces.index}/${p.pieces.total}`,
    `${p.weightKg.toFixed(2)}KG`,
    'N',
    recipientAddress.street,
    recipientAddress.city,
    'IDF',
    p.recipient.toUpperCase(),
  ].join(GS) +
  `${RS}06${GS}10ZGD003${GS}11Z${p.sender.name.toUpperCase()}${GS}12Z${phone(p)}${GS}31Z${String(p.seed).padStart(20, '0')}${RS}${EOT}`;

export const upsMaxiCode = (p: Planned) => {
  const t = p.tracking.value;
  return (
    HEADER +
    [
      `96${recipientAddress.postcode}`,
      '250',
      `0${t.slice(8, 10)}`,
      `1Z${t.slice(-8)}`,
      'UPSN',
      t.slice(2, 8),
      julianDay(p),
      '',
      `${p.pieces.index}/${p.pieces.total}`,
      String(Math.max(1, Math.round(p.weightKg / KG_PER_POUND))),
      'N',
      '',
      recipientAddress.city,
      '',
    ].join(GS) +
    `${RS}${EOT}`
  );
};

export const laPosteDataMatrix = (p: Planned) =>
  `FR00A001${p.tracking.value}0001`;
