import type { ComponentProps } from 'react';

import { ICON_PATHS, type IconName } from '#icons/paths';

export { ICON_PATHS, type IconName } from '#icons/paths';

export type IconProps = Omit<ComponentProps<'svg'>, 'children'> & {
  name: IconName;
  /** Rendered box, in px. The mockups use 16, 18, 20 and 22. */
  size?: number;
  /**
   * Stroke in *rendered* px, not grid units. Penpot keeps a 2 px stroke when
   * it scales a 24 px icon down to 20, so the stroke is converted back to the
   * 24 px grid here — that is what keeps a 16 px icon from looking heavier.
   */
  strokeWidth?: number;
};

/**
 * One stroked Lucide-style icon. It takes `currentColor`, so the colour comes
 * from the text colour of whatever wraps it.
 */
export function Icon({
  name,
  size = 20,
  strokeWidth = 2,
  className,
  ...props
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={(strokeWidth * 24) / size}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
      {...props}
    />
  );
}
