import { DeskPageHeader } from '#components/company-shell';
import { DetailsList, type DetailsItem } from '#components/details-list';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';

export type LieuLectureProps = {
  title: string;
  subtitle?: string;
  /** Place, hours of each day, instructions: what the e-mails tell the employee. */
  items: DetailsItem[];
  footer: string;
  onBack?: () => void;
};

/** Where and when the department hands parcels over, to read on the phone. */
export function LieuLectureMobile({
  title,
  items,
  footer,
  onBack,
}: LieuLectureProps) {
  return (
    <Screen>
      <NavBar title={title} onBack={onBack} />
      <DetailsList className="mt-4" items={items} />
      <p className="mt-4 text-13 leading-[1.4] text-muted">{footer}</p>
    </Screen>
  );
}

/** The same page in the computer's shell. */
export function LieuLectureDesktop({
  title,
  subtitle,
  items,
  footer,
}: LieuLectureProps) {
  return (
    <>
      <DeskPageHeader title={title} subtitle={subtitle} />
      <DetailsList variant="desk" className="mt-3 max-w-[560px]" items={items} />
      <p className="mt-4 max-w-[560px] text-13 text-muted">{footer}</p>
    </>
  );
}
