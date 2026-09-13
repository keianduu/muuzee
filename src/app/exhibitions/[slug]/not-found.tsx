import styles from "./page.module.css";

export default function ExhibitionNotFound() {
  return (
    <main className={styles.statePage}>
      <section className={styles.stateCard}>
        <h1>展覧会が見つかりません</h1>
        <p>公開が終了したか、URLが変更された可能性があります。</p>
      </section>
    </main>
  );
}
