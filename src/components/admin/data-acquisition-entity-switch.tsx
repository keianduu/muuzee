import Link from "next/link";
import { DATA_ACQUISITION_ENTITIES, type DataAcquisitionEntity } from "@/lib/admin/data-acquisition-summary";

const LABELS: Record<DataAcquisitionEntity, string> = {
  exhibitions: "Exhibitions",
  venues: "Venue",
  artists: "Artist",
  works: "Works",
};

export function DataAcquisitionEntitySwitch({ entity }: { entity: DataAcquisitionEntity }) {
  return <nav className="data-acquisition-entity-switch" aria-label="Entity">
    {DATA_ACQUISITION_ENTITIES.map((value) => <Link
      key={value}
      href={`/admin/imports/summary?entity=${value}`}
      aria-current={entity === value ? "page" : undefined}
      className={entity === value ? "is-active" : undefined}
      prefetch={false}
    >{LABELS[value]}</Link>)}
  </nav>;
}
