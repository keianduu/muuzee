"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { dataAcquisitionDetailQuery, shouldActivateDataAcquisitionDetail } from "@/lib/admin/data-acquisition-detail-state";
import type { DataAcquisitionEntity } from "@/lib/admin/data-acquisition-entity";

const NESTED_INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "form",
  "summary",
  "label",
  "[contenteditable='true']",
  "[role='button']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function hasNestedInteractiveTarget(target: EventTarget | null, currentTarget: HTMLElement) {
  if (!(target instanceof Element)) return false;
  const interactive = target.closest(NESTED_INTERACTIVE_SELECTOR);
  return Boolean(interactive && interactive !== currentTarget && currentTarget.contains(interactive));
}

export function DataAcquisitionDetailTrigger({ as: Element = "article", entity, className, id, label, children }: {
  as?: "article" | "section";
  entity: DataAcquisitionEntity;
  className: string;
  id?: string;
  label: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = () => {
    const query = dataAcquisitionDetailQuery(searchParams.toString(), entity);
    router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };
  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || hasNestedInteractiveTarget(event.target, event.currentTarget)) return;
    open();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const nested = hasNestedInteractiveTarget(event.target, event.currentTarget);
    if (!shouldActivateDataAcquisitionDetail(event.key, nested)) return;
    event.preventDefault();
    open();
  };

  return <Element
    className={`${className} data-acquisition-detail-trigger`}
    id={id}
    role="button"
    tabIndex={0}
    aria-label={label}
    data-data-acquisition-detail-trigger={entity}
    onClick={onClick}
    onKeyDown={onKeyDown}
  >{children}</Element>;
}
