import styles from "./page.module.css";

export default function ExhibitionDetailLoading() {
  return (
    <main className={styles.page} aria-busy="true" aria-label="展覧会情報を読み込み中">
      <div className={styles.brandBar}><span className={styles.brand}>Muuzee</span></div>
      <div className={styles.loadingHero} />
      <div className={styles.loadingBody}>
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
