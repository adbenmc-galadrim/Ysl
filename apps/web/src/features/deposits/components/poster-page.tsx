import { departmentQrText } from '@repo/contract/deposits';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, DepartmentPoster, encodeQr } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { db } from '#/features/db/database';
import { useCompanyName } from '#/features/directory/components/use-company-name';
import { initialsOf } from '#/features/settings/initials';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * In a frame of its own: printing narrows the window, which swaps the computer's
 * layout for the phone's and takes the page away from under the printer.
 */
function printAlone(poster: HTMLElement) {
  const frame = document.createElement('iframe');
  frame.title = t('poster.print');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  const styles = [...document.querySelectorAll('link[rel=stylesheet], style')]
    .map((node) => node.outerHTML)
    .join('');
  frame.srcdoc = `<!doctype html><html><head><base href="${document.baseURI}">${styles}<style>@page{size:A4;margin:0}html,body{margin:0;background:#fff}body{zoom:1.33}</style></head><body>${poster.innerHTML}</body></html>`;
  frame.onload = () => {
    frame.contentWindow?.addEventListener('afterprint', () => frame.remove());
    frame.contentWindow?.print();
  };
  document.body.append(frame);
}

/**
 * QR to print for the reception point (ME27). A department pulls only itself; the
 * company admin picks. Holds no secret: the shuttle can also choose from a list.
 */
export function PosterPage() {
  const navigate = useNavigate();
  const company = useCompanyName();
  const departments = useLiveQuery(
    () => db.department.filter((row) => !row.deletedAt).sortBy('name'),
    [],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const department =
    departments?.find(({ id }) => id === chosen) ?? departments?.[0];
  if (!departments) return null;
  const poster = department && (
    <DepartmentPoster
      initials={initialsOf(company)}
      company={company}
      name={department.name}
      place={department.receptionPoint}
      matrix={encodeQr(departmentQrText(department.id), 'M')}
      instruction={t('poster.instruction', { name: department.name })}
      code={department.id}
    />
  );
  return (
    <div className="flex flex-col items-center gap-5 px-5 pt-[calc(var(--safe-top)+12px)] pb-10">
      <div className="flex w-full max-w-[595px] items-center gap-3">
        <Button
          variant="secondary"
          size="md"
          className="w-fit px-4"
          onClick={() => void navigate({ to: '/reglages' })}
        >
          {t('poster.back')}
        </Button>
        {departments.length > 1 && (
          <select
            aria-label={t('settlement.select.department')}
            value={department?.id ?? ''}
            onChange={(event) => setChosen(event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-[6px] border border-border bg-surface px-2 text-15"
          >
            {departments.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
        <Button
          size="md"
          icon="printer"
          iconSize={18}
          className="ml-auto w-fit gap-2 px-4"
          onClick={() => posterRef.current && printAlone(posterRef.current)}
        >
          {t('poster.print')}
        </Button>
      </div>
      {poster ? (
        <div ref={posterRef} className="origin-top scale-[0.6] sm:scale-100">
          {poster}
        </div>
      ) : (
        <p className="text-15 text-muted">{t('poster.none')}</p>
      )}
    </div>
  );
}
