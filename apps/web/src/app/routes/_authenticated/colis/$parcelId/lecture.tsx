import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import type { ExtractionFieldName } from '#/features/db/schema';
import { ReadingView } from '#/features/diagnostic/components/reading-view';
import { READING_FIELDS } from '#/features/diagnostic/model';

export const Route = createFileRoute('/_authenticated/colis/$parcelId/lecture')(
  {
    validateSearch: (
      search: Record<string, unknown>,
    ): { champ?: ExtractionFieldName } =>
      READING_FIELDS.includes(search.champ as ExtractionFieldName)
        ? { champ: search.champ as ExtractionFieldName }
        : {},
    component: ReadingPage,
  },
);

function ReadingPage() {
  const { parcelId } = Route.useParams();
  const { champ } = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/colis/$parcelId', params: { parcelId } });
  };
  return (
    <ReadingView key={parcelId} id={parcelId} field={champ} onBack={back} />
  );
}
