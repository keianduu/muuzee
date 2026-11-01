export const DATA_ACQUISITION_ENTITIES = ["exhibitions", "venues", "artists", "works"] as const;
export type DataAcquisitionEntity = (typeof DATA_ACQUISITION_ENTITIES)[number];
