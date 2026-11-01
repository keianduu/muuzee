import { DATA_ACQUISITION_ENTITIES, type DataAcquisitionEntity } from "./data-acquisition-entity";

export function normalizeDataAcquisitionDetail(value?: string | null): DataAcquisitionEntity | null {
  return (DATA_ACQUISITION_ENTITIES as readonly string[]).includes(value || "")
    ? value as DataAcquisitionEntity
    : null;
}

export function dataAcquisitionDetailQuery(current: string, entity: DataAcquisitionEntity | null) {
  const params = new URLSearchParams(current);
  if (entity) params.set("detail", entity);
  else params.delete("detail");
  return params.toString();
}

export function shouldActivateDataAcquisitionDetail(key: string, nestedInteractive: boolean) {
  return !nestedInteractive && (key === "Enter" || key === " ");
}
