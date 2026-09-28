import * as React from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { GuestSavedMergeStatus } from "@/components/guest-saved/guest-saved-merge-status";
import AuthCompletePage from "./page";

vi.stubGlobal("React", React);

function includesType(node: ReactNode, target: unknown): boolean {
  if (!node || typeof node !== "object" || !("props" in node)) return false;
  const element = node as { type: unknown; props: { children?: ReactNode } };
  if (element.type === target) return true;
  const children = Array.isArray(element.props.children) ? element.props.children : [element.props.children];
  return children.some((child) => includesType(child, target));
}

describe("Auth completion Guest Saved handoff", () => {
  it("mounts the merge status only after a successful Auth completion", async () => {
    const page = await AuthCompletePage({ searchParams: Promise.resolve({}) });
    expect(includesType(page, GuestSavedMergeStatus)).toBe(true);
  });

  it("does not start Guest merge on the Auth error surface", async () => {
    const page = await AuthCompletePage({ searchParams: Promise.resolve({ authError: "temporary" }) });
    expect(includesType(page, GuestSavedMergeStatus)).toBe(false);
  });
});
