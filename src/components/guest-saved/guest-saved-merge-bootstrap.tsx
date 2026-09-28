"use client";

import { useEffect } from "react";
import { mergeGuestSaved } from "@/lib/guest-saved/merge";

export function bootstrapGuestSavedMerge() {
  return mergeGuestSaved();
}

/** Mount once in a future authenticated User Front shell to retry on session restore. */
export function GuestSavedMergeBootstrap() {
  useEffect(() => {
    void bootstrapGuestSavedMerge();
  }, []);
  return null;
}
