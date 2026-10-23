const PLANE = {
  24: 'M12,0L15,10L24,14L24,18L15,15L14,22L17,25L17,27L12,26L7,27L7,25L10,22L9,15L0,18L0,14L9,10Z',
  28: 'M14,0L17.5,12L28,17L28,21.5L17.5,18L16.5,26L20,29.5L20,32L14,30.5L8,32L8,29.5L11.5,26L10.5,18L0,21.5L0,17L10.5,12Z',
  16: 'M8,0L10,7L16,10L16,12.5L10,10.5L9.5,15L11.5,17L11.5,18.5L8,17.5L4.5,18.5L4.5,17L6.5,15L6,10.5L0,12.5L0,10L6,7Z',
} as const;

const PLANE_BOX = { 24: [24, 27], 28: [28, 32], 16: [16, 18.5] } as const;

export type PlaneProps = {
  size: keyof typeof PLANE;
  className?: string;
};

/** The flight-mode plane, at the three sizes the page draws it. */
export function Plane({ size, className }: PlaneProps) {
  const [w, h] = PLANE_BOX[size];
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={className}>
      <path d={PLANE[size]} />
    </svg>
  );
}
