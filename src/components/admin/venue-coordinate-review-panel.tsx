"use client";

import { useState } from "react";
import type { VenueCoordinateCandidateRow } from "@/lib/admin/types";
import { VenueCoordinateReview } from "./venue-coordinate-review";

export function VenueCoordinateReviewPanel({ venueId, candidates }: { venueId: string; candidates: VenueCoordinateCandidateRow[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function review(candidate: VenueCoordinateCandidateRow, action: "accept" | "reject") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/venues/${venueId}/coordinate-candidates/${candidate.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Coordinate review failed");
      setMessage(body.message || "更新しました。");
      window.dispatchEvent(new CustomEvent("muuzee:master-updated", { detail: { entity: "venues", id: venueId, preserveListOrder: true } }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Coordinate review failed"); }
    finally { setBusy(false); }
  }
  return <><VenueCoordinateReview venueId={venueId} candidates={candidates} busy={busy} onReview={review}/>{message && <div className={message.includes("failed") ? "error" : "notice"}>{message}</div>}</>;
}
