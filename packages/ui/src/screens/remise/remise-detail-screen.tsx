import { Banner } from '#components/banner';
import { DetailsList, type DetailsItem } from '#components/details-list';
import { IconTile } from '#components/icon-tile';
import { LargeTitle } from '#components/large-title';
import { ListRow } from '#components/list-row';
import { NavBar } from '#components/nav-bar';
import { ProofMedia, type ProofMediaProps } from '#components/proof-media';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';
import type { RemiseConfirmeeParcel } from '#screens/remise/remise-confirmee-screen';

/** A parcel of the handover: "Zalando", "DPD ···4471". */
export type RemiseDetailParcel = RemiseConfirmeeParcel;

export type RemiseDetailScreenProps = {
  /** "3 colis remis". */
  title: string;
  /** "à Nora Haddad". */
  subtitle: string;
  /** "Remise annulée aujourd’hui à 11 h 25". */
  cancelled?: string;
  items: DetailsItem[];
  /** The signature and the photo, when this iPhone holds them (D8). */
  media?: ProofMediaProps;
  parcels: RemiseDetailParcel[];
  onBack?: () => void;
  onParcel?: (parcel: RemiseDetailParcel) => void;
};

/** One handover of the journal: its proof, then each parcel it lists. */
export function RemiseDetailScreen({
  title,
  subtitle,
  cancelled,
  items,
  media,
  parcels,
  onBack,
  onParcel,
}: RemiseDetailScreenProps) {
  return (
    <Screen>
      <NavBar title="Remise" onBack={onBack} />
      <LargeTitle
        size="md"
        title={title}
        subtitle={subtitle}
        className="mt-3.5"
      />
      {cancelled && (
        <Banner
          tone="grey"
          icon="undo"
          title={cancelled}
          className="mt-[15px] rounded-control"
        />
      )}
      <DetailsList title="Remise" items={items} className="mt-5" />
      {media && <ProofMedia {...media} className="mt-3" />}
      {parcels.length > 0 && (
        <section className="mt-7">
          <SectionHeader title="Colis" count={parcels.length} />
          <div className="mt-4">
            {parcels.map((parcel, i) => (
              <ListRow
                key={parcel.id}
                leading={<IconTile icon="package" tone="fill" />}
                title={parcel.title}
                lines={[{ text: parcel.detail }]}
                separator={i < parcels.length - 1}
                onClick={onParcel && (() => onParcel(parcel))}
              />
            ))}
          </div>
        </section>
      )}
    </Screen>
  );
}
