import { ImageIcon } from "lucide-react";
import styles from "./kiosk.module.css";

export function BeforeAfterPreview({ categoryName }: { categoryName: string }) {
  return (
    <section className={styles.beforeAfter} aria-label={`${categoryName} 보정 전후 예시`}>
      <div className={styles.beforeAfterHead}>
        <div>
          <h2>보정 전후 예시</h2>
          <p>실제 예시 사진이 들어갈 자리예요.</p>
        </div>
        <span>이미지 준비 중</span>
      </div>
      <div className={styles.beforeAfterGrid}>
        <div className={styles.previewColumn}>
          <strong>BEFORE</strong>
          <div className={styles.previewPlaceholder} aria-label="보정 전 사진 자리">
            <ImageIcon aria-hidden="true" />
            <span>사진 준비 중</span>
          </div>
        </div>
        <div className={`${styles.previewColumn} ${styles.previewColumnAfter}`}>
          <strong>AFTER</strong>
          <div className={styles.previewPlaceholder} aria-label="보정 후 사진 자리">
            <ImageIcon aria-hidden="true" />
            <span>사진 준비 중</span>
          </div>
        </div>
      </div>
    </section>
  );
}
