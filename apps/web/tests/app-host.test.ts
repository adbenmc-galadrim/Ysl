import { describe, expect, it } from 'vitest';
import { displayHost } from '#/features/install/app-host';

describe('displayHost', () => {
  it('prints the bare host of the app URL', () => {
    expect(displayHost('https://ysl.shinseo.fr/')).toBe('ysl.shinseo.fr');
  });

  it('keeps the path when the app is served under one', () => {
    expect(displayHost('https://example.fr/courrier/')).toBe(
      'example.fr/courrier',
    );
  });
});
