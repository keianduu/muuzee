"use client";

import type { MediaAssetRow, SourceImageCandidateRow, VenueRow } from "@/lib/admin/types";
import { AdminImageManager } from "./admin-image-manager";

export function VenueImageEditor({ venue, busy, candidates, onUpload, onRemove, onOpenImageCandidate, onSetPrimary }: {
  venue: VenueRow;
  busy: boolean;
  candidates: SourceImageCandidateRow[];
  onUpload: (form: FormData) => Promise<void>;
  onRemove: (asset: MediaAssetRow) => void;
  onOpenImageCandidate?: (candidateId: string | null) => void;
  onSetPrimary: (candidate: SourceImageCandidateRow) => void;
}) {
  return <AdminImageManager
    entity="venues"
    ownerId={venue.id}
    subjectLabel={venue.name}
    initialAssets={venue.media_assets}
    busy={busy}
    candidates={candidates}
    onUpload={onUpload}
    onRemove={onRemove}
    onOpenImageCandidate={onOpenImageCandidate}
    onSetPrimary={onSetPrimary}
  />;
}
