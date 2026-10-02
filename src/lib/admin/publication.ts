export type PublicationInput = {
  title: string | null | undefined;
  venueId: string | null | undefined;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  primaryImage?: {
    id?: string;
    rightsStatus: string | null | undefined;
  } | null;
};

export type PublicationRequirement = {
  key: "title" | "venue" | "dates" | "primary_image" | "image_rights";
  label: string;
  met: boolean;
};

export function evaluatePublication(input: PublicationInput) {
  const requirements: PublicationRequirement[] = [
    { key: "title", label: "タイトル", met: Boolean(input.title?.trim()) },
    { key: "venue", label: "会場", met: Boolean(input.venueId) },
    { key: "dates", label: "開始日または終了日", met: Boolean(input.startDate || input.endDate) },
    { key: "primary_image", label: "Primary画像", met: Boolean(input.primaryImage) },
    {
      key: "image_rights",
      label: "Primary画像のRights承認",
      met: input.primaryImage?.rightsStatus === "approved",
    },
  ];
  return {
    canPublish: requirements.every((requirement) => requirement.met),
    requirements,
    missing: requirements.filter((requirement) => !requirement.met).map((requirement) => requirement.label),
  };
}

export function statusAfterUnpublish() {
  return "draft";
}
