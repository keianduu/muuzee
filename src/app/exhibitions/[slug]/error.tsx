"use client";

import styles from "./page.module.css";

export default function ExhibitionDetailError() {
  return (
    <main className={styles.statePage}>
      <section className={styles.stateCard} role="alert">
        <h1>展覧会情報を読み込めませんでした</h1>
        <p>通信またはデータ取得で問題が発生しました。もう一度お試しください。</p>
        <button className={styles.retryButton} type="button" onClick={() => window.location.reload()}>再読み込み</button>
      </section>
    </main>
  );
}
