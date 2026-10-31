import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import type { LocalDeposit } from '#/features/db/schema';
import { gapLine, pendingParcelIds } from '#/features/parcels/deposit';
import { formatTime } from '#/features/parcels/model';
import { currentTour } from '#/features/parcels/tour-view';

const t = createTranslator(DEFAULT_LOCALE);

const NOW = new Date(2026, 9, 31, 12);
const at = (hour: number, day = 31) => new Date(2026, 9, day, hour);

const row = (
  id: string,
  status: string,
  departmentId: string,
  receivedAt: Date,
  depositedAt: Date | null = null,
) =>
  ({
    id,
    status,
    departmentId,
    receivedAt,
    depositedAt,
    deletedAt: null,
  }) as never as Parameters<typeof currentTour>[0][number];

describe('currentTour', () => {
  it('groups what is carried by department, and counts what is done', () => {
    const view = currentTour(
      [
        row('a', 'en_route', 'finance', at(8)),
        row('b', 'en_route', 'finance', at(8)),
        row('c', 'en_route', 'studio', at(9)),
        row('d', 'depose', 'courrier', at(8), at(9)),
      ],
      NOW,
    );
    expect(
      view.stops.map((stop) => [stop.departmentId, stop.parcels.length]),
    ).toEqual([
      ['finance', 2],
      ['studio', 1],
    ]);
    expect(view.done).toEqual([
      { departmentId: 'courrier', count: 1, confirmedAt: at(9) },
    ]);
    expect(view).toMatchObject({
      served: 1,
      departments: 3,
      left: 3,
      closed: false,
    });
  });

  it('counts a department half deposited as still to serve', () => {
    const view = currentTour(
      [
        row('a', 'en_route', 'finance', at(8)),
        row('b', 'depose', 'finance', at(8), at(9)),
      ],
      NOW,
    );
    expect(view).toMatchObject({ served: 0, departments: 1, left: 1 });
  });

  it('closes once everything is deposited, whatever became of it next', () => {
    const view = currentTour(
      [
        row('a', 'notifie', 'finance', at(8), at(9)),
        row('b', 'remis', 'finance', at(8), at(10)),
      ],
      NOW,
    );
    expect(view).toMatchObject({
      closed: true,
      left: 0,
      deposited: 2,
      served: 1,
    });
  });

  it('is not held open by a gap or a return', () => {
    const view = currentTour(
      [
        row('a', 'depose', 'finance', at(8), at(9)),
        row('gap', 'a_regulariser', 'finance', at(8), at(9)),
        row('back', 'retourne', 'finance', at(8)),
      ],
      NOW,
    );
    expect(view).toMatchObject({ closed: true, left: 0, deposited: 1 });
  });

  it('leaves out the deposits of a tour already closed', () => {
    const view = currentTour(
      [
        row('old', 'depose', 'finance', at(8), at(9)),
        row('new', 'en_route', 'studio', at(10)),
      ],
      NOW,
    );
    expect(view.done).toEqual([]);
    expect(view).toMatchObject({ departments: 1, left: 1 });
  });

  it('dates a parcel sent again from the day it left, not its reception', () => {
    const parcels = [
      row('old', 'depose', 'finance', at(8), at(9)),
      row('again', 'en_route', 'studio', at(7)),
    ];
    expect(currentTour(parcels, NOW).done).toHaveLength(1);
    expect(
      currentTour(parcels, NOW, new Map([['again', at(10)]])).done,
    ).toEqual([]);
  });

  it('forgets a closed tour the next day', () => {
    const view = currentTour(
      [row('a', 'depose', 'finance', at(8, 30), at(9, 30))],
      NOW,
    );
    expect(view).toMatchObject({ closed: false, departments: 0, deposited: 0 });
  });
});

describe('the deposit on the way', () => {
  it('holds back what a deposit still to count announced, not the rest', () => {
    const posted = {
      parcelIds: ['a'],
      confirmedAt: null,
      deletedAt: null,
    } as unknown as LocalDeposit;
    const counted = {
      parcelIds: ['b'],
      confirmedAt: new Date(),
      deletedAt: null,
    } as unknown as LocalDeposit;
    expect([...pendingParcelIds([posted, counted])]).toEqual(['a']);
  });

  it('says the count in the banner, or the employee gone', () => {
    const postedAt = new Date('2026-10-31T09:40:00');
    expect(
      gapLine(
        { gap: 'missing', counted: 4, announced: 5, postedAt },
        'Finance',
        t,
      ),
    ).toBe(
      `Finance a compté 4 colis sur 5 au dépôt de ${formatTime(postedAt)}.`,
    );
    expect(
      gapLine(
        { gap: 'left', counted: 5, announced: 5, postedAt },
        'Finance',
        t,
      ),
    ).toContain('salarié parti');
  });
});
