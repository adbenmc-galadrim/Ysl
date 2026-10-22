import sharp from 'sharp';
import type { Planned } from '#synthetic/plan';
import { height, image, width } from '#synthetic/svg';
import { labelSvg } from '#synthetic/templates';

const frame = { width: 1200, height: 1600 };

const crumple = (seed: number) =>
  `<filter id="crumple"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="14" xChannelSelector="R" yChannelSelector="G"/></filter>`;

const scene = (label: Buffer, p: Planned) => {
  const x = (frame.width - width) / 2;
  const y = (frame.height - height) / 2;
  const { tilt, crumpled } = p.shot;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}">
<defs>
<filter id="cardboard"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${p.seed % 997}"/><feColorMatrix values="0 0 0 0 0.62  0 0 0 0 0.47  0 0 0 0 0.3  0 0 0 0.35 0"/><feComposite in2="SourceGraphic" operator="over"/></filter>
${crumpled ? crumple(p.seed % 991) : ''}
</defs>
<rect width="100%" height="100%" fill="#b08a5b"/>
<rect width="100%" height="100%" fill="#b08a5b" filter="url(#cardboard)"/>
<g transform="rotate(${tilt} ${frame.width / 2} ${frame.height / 2})"${crumpled ? ' filter="url(#crumple)"' : ''}>${image(x, y, width, height, label)}</g>
</svg>`;
};

const glare = (p: Planned) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}"><defs><radialGradient id="g" cx="${30 + (p.seed % 40)}%" cy="${25 + (p.seed % 50)}%" r="28%"><stop offset="0" stop-color="#fff" stop-opacity="0.92"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );

const grain = (p: Planned) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="1.6" seed="${p.seed % 983}"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="0.35"/></svg>`,
  );

export const photograph = async (p: Planned) => {
  const label = await sharp(Buffer.from(await labelSvg(p)))
    .png()
    .toBuffer();
  const base = await sharp(Buffer.from(scene(label, p)))
    .png()
    .toBuffer();
  const overlays = [
    ...(p.shot.glare ? [{ input: glare(p), blend: 'screen' as const }] : []),
    ...(p.shot.noise ? [{ input: grain(p), blend: 'overlay' as const }] : []),
  ];
  let photo = sharp(base).composite(overlays);
  if (p.shot.blur > 0 || p.shot.lowLight) {
    photo = sharp(await photo.png().toBuffer());
  }
  if (p.shot.blur > 0) photo = photo.blur(p.shot.blur);
  if (p.shot.lowLight) photo = photo.modulate({ brightness: 0.5 }).gamma(2.2);
  return photo.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
};
