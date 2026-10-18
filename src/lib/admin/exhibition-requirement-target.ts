import type { PublicationRequirement } from "./publication";

export type ExhibitionRequirementTarget = {
  detailTab: "edit";
  editTab: "basic" | "image";
  selector: string;
};

const TARGETS: Record<PublicationRequirement["key"], ExhibitionRequirementTarget> = {
  title: { detailTab: "edit", editTab: "basic", selector: "#exhibition-title" },
  venue: { detailTab: "edit", editTab: "basic", selector: "#exhibition-venue-name" },
  dates: { detailTab: "edit", editTab: "basic", selector: "#exhibition-start-date" },
  primary_image: { detailTab: "edit", editTab: "image", selector: '[data-admin-image-section="candidates"], [data-admin-image-section="registration"]' },
  image_rights: { detailTab: "edit", editTab: "image", selector: '[data-admin-rights-remediation], [data-admin-image-section="candidates"], [data-admin-image-section="registered"]' },
};

export function exhibitionRequirementTarget(key: PublicationRequirement["key"]) {
  return TARGETS[key];
}
