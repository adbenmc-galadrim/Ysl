const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

type TextOptions = {
  size?: number;
  weight?: 'normal' | 'bold';
  anchor?: 'start' | 'middle' | 'end';
  fill?: string;
  rotate?: number;
  mono?: boolean;
};

export const text = (
  x: number,
  y: number,
  value: string,
  {
    size = 22,
    weight = 'normal',
    anchor = 'start',
    fill = '#111',
    rotate,
    mono,
  }: TextOptions = {},
) =>
  `<text x="${x}" y="${y}" font-family="${mono ? 'Courier New, monospace' : 'Helvetica, Arial, sans-serif'}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}"${rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : ''}>${escape(value)}</text>`;

export const lines = (
  x: number,
  y: number,
  values: string[],
  options: TextOptions & { gap?: number } = {},
) =>
  values
    .map((value, i) =>
      text(
        x,
        y + i * (options.gap ?? (options.size ?? 22) * 1.25),
        value,
        options,
      ),
    )
    .join('');

export const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  { fill = 'none', stroke = '#111', width = 3 } = {},
) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;

export const line = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = 3,
) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="${width}"/>`;

export const image = (
  x: number,
  y: number,
  w: number,
  h: number,
  png: Buffer,
  stretch = false,
) =>
  `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${stretch ? 'none' : 'xMidYMid meet'}" href="data:image/png;base64,${png.toString('base64')}"/>`;

export const width = 800;
export const height = 1200;

export const document = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#fff"/>${body}</svg>`;
