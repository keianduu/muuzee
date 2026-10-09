import React from "react";

type Props = {
  selectedCount: number;
  busy: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onClear: () => void;
};

export function AdminFloatingBulkActions({ selectedCount, busy, onPublish, onUnpublish, onClear }: Props) {
  if (selectedCount === 0) return null;
  return <div className="admin-floating-bulk-actions" role="region" aria-label="選択項目の一括操作">
    <strong aria-live="polite">{selectedCount}件選択中</strong>
    <div className="admin-floating-bulk-buttons" role="group" aria-label="公開状態の一括変更">
      <button className="button" type="button" disabled={busy} onClick={onPublish}>公開</button>
      <button className="button secondary" type="button" disabled={busy} onClick={onUnpublish}>非公開</button>
      <button className="button tertiary" type="button" disabled={busy} onClick={onClear}>選択解除</button>
    </div>
  </div>;
}
