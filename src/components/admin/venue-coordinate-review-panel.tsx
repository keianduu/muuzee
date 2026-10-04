"use client";

import { useState } from "react";
import type { VenueCoordinateCandidateRow } from "@/lib/admin/types";
import { VenueCoordinateReview } from "./venue-coordinate-review";
import { AdminFeedback } from "./admin-feedback";
import { VENUE_COORDINATE_SELECTED_EVENT } from "@/lib/admin/venue-coordinate-selection";

export function VenueCoordinateReviewPanel({ venueId, candidates, onSelected }: { venueId: string; candidates: VenueCoordinateCandidateRow[]; onSelected?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function review(candidate: VenueCoordinateCandidateRow, action: "accept" | "reject") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/venues/${venueId}/coordinate-candidates/${candidate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Coordinate review failed");
      setMessage(body.message || "更新しました。");
      if (action === "accept") {
        window.dispatchEvent(new CustomEvent(VENUE_COORDINATE_SELECTED_EVENT, { detail: {
          venueId,
          latitude: Number(body.latitude),
          longitude: Number(body.longitude),
          source: String(body.source || candidate.source),
          precision: String(body.precision || candidate.precision || "exact"),
        } }));
      }
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", { detail: { entity: "venues", id: venueId, preserveListOrder: true } }));
      if (action === "accept") onSelected?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Coordinate review failed"); }
    finally { setBusy(false); }
  }
  return <><VenueCoordinateReview venueId={venueId} candidates={candidates} busy={busy} onReview={review}/><AdminFeedback variant={message.includes("failed") ? "error" : "success"} message={message}/></>;
}
