export type AdminRelationItem = {
  id: string;
  label: string;
  meta?: string | null;
};

export function AdminRelationList({ title, items, emptyLabel }: { title: string; items: AdminRelationItem[]; emptyLabel: string }) {
  return <section className="admin-relation-section">
    <h2>{title}</h2>
    <div className="card admin-relation-list">
      {items.map((item) => <div className="admin-relation-row" key={item.id}><strong>{item.label}</strong>{item.meta && <span className="muted">{item.meta}</span>}</div>)}
      {!items.length && <p className="empty-state">{emptyLabel}</p>}
    </div>
  </section>;
}
