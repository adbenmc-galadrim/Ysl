import { barcode } from '#synthetic/barcode';
import {
  recipientAddress,
  recipientCompany,
  type Sender,
} from '#synthetic/identities';
import type { Planned, SyntheticCarrier } from '#synthetic/plan';
import { document, image, line, lines, rect, text } from '#synthetic/svg';

const to = (p: Planned) => [
  p.recipient.toUpperCase(),
  recipientCompany,
  recipientAddress.street,
  `${recipientAddress.postcode} ${recipientAddress.city}`,
  recipientAddress.country,
];

const from = (s: Sender) => [
  s.name,
  s.street,
  `${s.postcode} ${s.city}`,
  s.country,
];

const weight = (p: Planned) => `${p.weightKg.toFixed(1).replace('.', ',')} kg`;
const pieces = (p: Planned) => `${p.pieces.index}/${p.pieces.total}`;
const date = (p: Planned) =>
  `${String((p.seed % 28) + 1).padStart(2, '0')}/10/2026`;

const colissimo = async (p: Planned) => {
  const id = p.tracking.value;
  return [
    rect(20, 20, 760, 1160),
    text(40, 90, 'colissimo', { size: 58, weight: 'bold', fill: '#e2001a' }),
    text(760, 80, 'LA POSTE', { size: 24, anchor: 'end', weight: 'bold' }),
    text(760, 110, 'Colissimo Expert France', { size: 20, anchor: 'end' }),
    rect(40, 140, 720, 170),
    text(55, 170, 'EXPÉDITEUR', { size: 18, weight: 'bold' }),
    lines(55, 200, from(p.sender), { size: 20 }),
    rect(40, 330, 720, 260, { width: 5 }),
    text(55, 362, 'DESTINATAIRE', { size: 18, weight: 'bold' }),
    lines(55, 405, to(p), { size: 32, weight: 'bold', gap: 38 }),
    text(55, 640, `Poids : ${weight(p)}`, { size: 24 }),
    text(400, 640, `Colis ${pieces(p)}`, { size: 24 }),
    text(55, 675, `Date : ${date(p)}`, { size: 20 }),
    image(
      560,
      600,
      190,
      190,
      await barcode('datamatrix', `${id}${recipientAddress.postcode}`),
    ),
    image(
      60,
      820,
      680,
      200,
      await barcode(
        'code128',
        `%00${recipientAddress.postcode}11${id.slice(0, 12)}25025`,
      ),
      true,
    ),
    text(400, 1070, p.tracking.printed, {
      size: 34,
      weight: 'bold',
      anchor: 'middle',
      mono: true,
    }),
    text(
      400,
      1130,
      'Suivez votre colis sur laposte.fr/outils/suivre-vos-envois',
      { size: 16, anchor: 'middle' },
    ),
  ].join('');
};

const chronopost = async (p: Planned) =>
  [
    rect(20, 20, 760, 1160),
    rect(20, 20, 760, 110, { fill: '#003d7c' }),
    text(40, 95, 'Chronopost', { size: 56, weight: 'bold', fill: '#fff' }),
    text(760, 95, 'CHRONO 13', {
      size: 34,
      weight: 'bold',
      fill: '#fff',
      anchor: 'end',
    }),
    text(40, 175, 'Expéditeur', { size: 18, weight: 'bold' }),
    lines(40, 205, from(p.sender), { size: 20 }),
    image(
      560,
      150,
      200,
      200,
      await barcode(
        'azteccode',
        `${p.tracking.value}|${recipientAddress.postcode}|${p.weightKg}`,
      ),
    ),
    line(20, 370, 780, 370),
    text(40, 410, 'Destinataire', { size: 18, weight: 'bold' }),
    lines(40, 455, to(p), { size: 34, weight: 'bold', gap: 42 }),
    line(20, 700, 780, 700),
    text(40, 745, `Poids ${weight(p)}`, { size: 26, weight: 'bold' }),
    text(330, 745, `Colis ${pieces(p)}`, { size: 26, weight: 'bold' }),
    text(560, 745, date(p), { size: 22 }),
    image(60, 790, 680, 210, await barcode('code128', p.tracking.value), true),
    text(400, 1060, p.tracking.printed, {
      size: 40,
      weight: 'bold',
      anchor: 'middle',
      mono: true,
    }),
    text(400, 1120, 'chronopost.fr', { size: 18, anchor: 'middle' }),
  ].join('');

const laPoste = async (p: Planned) =>
  [
    rect(20, 300, 760, 600),
    rect(20, 300, 760, 70, { fill: '#ffcc00' }),
    text(40, 350, 'LA POSTE · Lettre suivie', { size: 34, weight: 'bold' }),
    image(
      40,
      400,
      200,
      200,
      await barcode('datamatrix', `FR00A001${p.tracking.value}0001`),
    ),
    text(270, 440, 'N° de suivi', { size: 20 }),
    text(270, 485, p.tracking.printed, {
      size: 32,
      weight: 'bold',
      mono: true,
    }),
    text(270, 540, `Déposé le ${date(p)}`, { size: 20 }),
    lines(270, 580, [p.sender.name, `${p.sender.postcode} ${p.sender.city}`], {
      size: 18,
    }),
    line(20, 630, 780, 630),
    lines(60, 690, to(p), { size: 30, gap: 38 }),
  ].join('');

const dhlExpress = async (p: Planned) => {
  const waybill = p.tracking.value;
  return [
    rect(20, 20, 690, 1160),
    rect(720, 20, 60, 1160, { fill: '#d40511', stroke: '#d40511' }),
    text(765, 1120, 'DOCUMENTS · DOKUMENTE · DOCUMENTI', {
      size: 34,
      weight: 'bold',
      fill: '#111',
      rotate: -90,
    }),
    text(40, 80, 'EXPRESS WORLDWIDE', { size: 30, weight: 'bold' }),
    rect(420, 40, 100, 56),
    text(470, 80, 'ECX', { size: 30, weight: 'bold', anchor: 'middle' }),
    text(690, 82, 'DHL', {
      size: 52,
      weight: 'bold',
      fill: '#d40511',
      anchor: 'end',
    }),
    text(40, 130, 'From :', { size: 18, weight: 'bold' }),
    lines(110, 130, from(p.sender), { size: 18 }),
    text(690, 135, 'Origin:', { size: 18, anchor: 'end' }),
    text(690, 170, p.sender.country === 'FR' ? 'CDG' : 'MXP', {
      size: 28,
      weight: 'bold',
      anchor: 'end',
    }),
    rect(40, 250, 650, 230),
    text(55, 285, 'To :', { size: 20, weight: 'bold' }),
    lines(110, 285, to(p), { size: 26, gap: 36 }),
    text(40, 540, 'FR-ORY-PSV', { size: 50, weight: 'bold' }),
    text(690, 540, String((p.seed % 9000) + 1000), { size: 42, anchor: 'end' }),
    rect(40, 560, 380, 50, { fill: '#111' }),
    text(55, 597, 'ADI-SIR', { size: 30, weight: 'bold', fill: '#fff' }),
    text(460, 640, 'Pce/Shpt Weight', { size: 16 }),
    text(620, 640, 'Piece', { size: 16 }),
    text(460, 680, weight(p), { size: 28, weight: 'bold' }),
    text(620, 680, pieces(p), { size: 28, weight: 'bold' }),
    image(60, 720, 420, 110, await barcode('code128', waybill), true),
    text(270, 860, `WAYBILL ${p.tracking.printed}`, {
      size: 22,
      anchor: 'middle',
    }),
    image(
      60,
      880,
      600,
      110,
      await barcode('code128', `2LFR${recipientAddress.postcode}+51000000`),
      true,
    ),
    text(360, 1020, `(2L)FR${recipientAddress.postcode}+51000000`, {
      size: 18,
      anchor: 'middle',
    }),
    image(
      60,
      1040,
      600,
      90,
      await barcode('code128', `JJD01460001${waybill}`),
      true,
    ),
    text(360, 1160, `(J) JJD01 4600 01${waybill}`, {
      size: 18,
      anchor: 'middle',
    }),
  ].join('');
};

const ups = async (p: Planned) => {
  const t = p.tracking.value;
  const maxicode = await barcode(
    'maxicode',
    `[)>^03001^02996${recipientAddress.postcode}^029250^029011^029${t}^029UPSN^029${t.slice(2, 8)}^029${(p.seed % 365) + 1}^029^029${pieces(p)}^029${Math.round(p.weightKg)}^029N^029^029${recipientAddress.city}^029FR^030^004`,
  ).catch(() => barcode('maxicode', `${t} ${recipientAddress.postcode}`));
  return [
    rect(20, 20, 760, 1160),
    lines(40, 60, from(p.sender), { size: 18 }),
    text(760, 60, weight(p), { size: 26, weight: 'bold', anchor: 'end' }),
    text(760, 95, `${pieces(p)}`, { size: 26, weight: 'bold', anchor: 'end' }),
    text(40, 200, 'SHIP TO:', { size: 18, weight: 'bold' }),
    lines(70, 235, to(p), { size: 30, weight: 'bold', gap: 38 }),
    line(20, 440, 780, 440, 5),
    image(40, 460, 260, 260, maxicode),
    text(340, 560, `FRA ${recipientAddress.postcode.slice(0, 3)} 9-01`, {
      size: 50,
      weight: 'bold',
    }),
    image(
      340,
      590,
      400,
      110,
      await barcode('code128', `421250${recipientAddress.postcode}`),
      true,
    ),
    line(20, 740, 780, 740, 5),
    text(40, 810, 'UPS STANDARD', { size: 48, weight: 'bold' }),
    text(760, 810, '11', { size: 60, weight: 'bold', anchor: 'end' }),
    text(40, 860, `TRACKING #: ${p.tracking.printed}`, {
      size: 26,
      weight: 'bold',
    }),
    line(20, 880, 780, 880, 5),
    image(60, 900, 680, 200, await barcode('code128', t), true),
    text(40, 1150, `BILLING: P/P   ${date(p)}`, { size: 18 }),
  ].join('');
};

const fedex = async (p: Planned) =>
  [
    rect(20, 20, 760, 1160),
    text(40, 80, 'Fed', { size: 60, weight: 'bold', fill: '#4d148c' }),
    text(140, 80, 'Ex', { size: 60, weight: 'bold', fill: '#ff6600' }),
    text(760, 70, 'INTERNATIONAL PRIORITY', {
      size: 22,
      weight: 'bold',
      anchor: 'end',
    }),
    text(40, 120, 'ORIGIN ID:', { size: 16 }),
    lines(40, 150, from(p.sender), { size: 18 }),
    text(760, 150, `ACTWGT: ${p.weightKg.toFixed(2)} KG`, {
      size: 18,
      anchor: 'end',
    }),
    text(760, 180, `SHIP DATE: ${date(p)}`, { size: 18, anchor: 'end' }),
    text(40, 270, 'TO', { size: 22, weight: 'bold' }),
    lines(80, 270, to(p), { size: 30, weight: 'bold', gap: 38 }),
    image(
      40,
      480,
      720,
      180,
      await barcode(
        'pdf417',
        `[)>06${p.tracking.value}${recipientAddress.postcode}${p.recipient}`,
      ),
    ),
    text(40, 720, 'TRK#', { size: 22, weight: 'bold' }),
    text(130, 720, p.tracking.printed, {
      size: 44,
      weight: 'bold',
      mono: true,
    }),
    text(760, 720, `${pieces(p)}`, { size: 28, anchor: 'end' }),
    text(40, 790, 'XK PARA', { size: 56, weight: 'bold' }),
    text(760, 790, 'CDG', { size: 56, weight: 'bold', anchor: 'end' }),
    image(
      60,
      830,
      680,
      230,
      await barcode(
        'code128',
        `9622${String(p.seed).padStart(10, '0').slice(0, 10)}0000${p.tracking.value}`.slice(
          0,
          34,
        ),
      ),
      true,
    ),
  ].join('');

const dpd = async (p: Planned) => {
  const t = p.tracking.value;
  return [
    rect(20, 20, 760, 1160),
    text(40, 60, 'Soumis aux CGV consultables sur www.dpd.fr', { size: 15 }),
    text(760, 70, 'dpd', {
      size: 50,
      weight: 'bold',
      fill: '#dc0032',
      anchor: 'end',
    }),
    line(20, 100, 780, 100),
    text(40, 150, recipientCompany, { size: 22 }),
    lines(
      40,
      200,
      [
        p.recipient.toUpperCase(),
        recipientAddress.street,
        `F-${recipientAddress.postcode}`,
        recipientAddress.city,
      ],
      { size: 32, weight: 'bold', gap: 40 },
    ),
    line(470, 100, 470, 380),
    text(500, 370, 'Expéditeur', { size: 16, rotate: -90 }),
    ...from(p.sender).map((value, i) =>
      text(530 + i * 26, 370, value, { size: 18, rotate: -90 }),
    ),
    line(20, 380, 780, 380),
    text(40, 420, `Colis ${pieces(p)}`, { size: 22 }),
    text(40, 455, `Poids ${weight(p)}`, { size: 22 }),
    text(40, 490, `Réf. ${p.seed % 10000000}`, { size: 22 }),
    image(
      470,
      395,
      290,
      290,
      await barcode(
        'azteccode',
        `${t}|${p.recipient}|${pieces(p)}|${p.weightKg}|${p.sender.name}`,
      ),
    ),
    line(20, 700, 780, 700),
    text(40, 760, p.tracking.printed.slice(0, 4), { size: 46, weight: 'bold' }),
    text(155, 760, p.tracking.printed.slice(4), { size: 36 }),
    text(760, 760, 'CLASSIC', { size: 30, weight: 'bold', anchor: 'end' }),
    text(
      40,
      840,
      `FR-DPD-${recipientAddress.postcode.slice(0, 2)}${(p.seed % 90) + 10}`,
      { size: 50, weight: 'bold' },
    ),
    image(
      60,
      880,
      680,
      220,
      await barcode('code128', `%00${recipientAddress.postcode}${t}101250`),
      true,
    ),
    text(400, 1140, `00${recipientAddress.postcode} ${t} 101 250`, {
      size: 20,
      anchor: 'middle',
      mono: true,
    }),
  ].join('');
};

const gls = async (p: Planned) =>
  [
    rect(20, 20, 760, 1160),
    text(40, 90, 'GLS', { size: 72, weight: 'bold', fill: '#061ab1' }),
    text(760, 80, 'BusinessParcel', { size: 26, anchor: 'end' }),
    image(
      40,
      130,
      230,
      230,
      await barcode(
        'datamatrix',
        `${p.tracking.value}|${recipientAddress.postcode}|${p.weightKg}`,
      ),
    ),
    image(
      530,
      130,
      230,
      230,
      await barcode(
        'datamatrix',
        `${p.recipient}|${recipientAddress.street}|${recipientAddress.postcode} ${recipientAddress.city}`,
      ),
    ),
    text(400, 230, 'FR 75', { size: 64, weight: 'bold', anchor: 'middle' }),
    text(400, 300, pieces(p), { size: 36, anchor: 'middle' }),
    line(20, 380, 780, 380),
    text(40, 420, 'Track ID', { size: 18 }),
    text(40, 465, p.tracking.printed, { size: 40, weight: 'bold', mono: true }),
    text(760, 465, weight(p), { size: 30, weight: 'bold', anchor: 'end' }),
    line(20, 490, 780, 490),
    text(40, 530, 'Empfänger / Destinataire', { size: 18 }),
    lines(40, 575, to(p), { size: 32, weight: 'bold', gap: 40 }),
    line(20, 800, 780, 800),
    text(40, 840, 'Absender / Expéditeur', { size: 18 }),
    lines(40, 875, from(p.sender), { size: 22 }),
    image(60, 1000, 680, 140, await barcode('code128', p.tracking.value), true),
  ].join('');

const templates: Record<SyntheticCarrier, (p: Planned) => Promise<string>> = {
  colissimo,
  chronopost,
  'la-poste': laPoste,
  'dhl-express': dhlExpress,
  ups,
  fedex,
  dpd,
  gls,
};

export const labelSvg = async (p: Planned) =>
  document(await templates[p.carrier](p));
