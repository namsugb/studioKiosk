import { visaCountries, type VisaCountryId } from "@/lib/catalog/visa-countries";
import styles from "./kiosk.module.css";

export function VisaCountryStep({ onSelect }: { onSelect: (id: VisaCountryId) => void }) {
  return (
    <>
      <h1 className="title-lg">어느 나라 비자사진이 필요한가요?</h1>
      <p className={styles.lead}>국가를 선택하면 필요한 규격과 촬영 기준을 확인할 수 있어요.</p>
      <div className={styles.visaCountryList}>
        {visaCountries.map((country) => (
          <button className={`card card-select ${styles.visaCountryCard}`} key={country.id} onClick={() => onSelect(country.id)}>
            <span className={styles.visaCountryName}>{country.name}</span>
            <strong className={styles.visaCountrySize}>{country.size}</strong>
            <span className={styles.visaCountryNote}>{country.note}</span>
          </button>
        ))}
      </div>
      <p className="caption tertiary" style={{ marginTop: 16 }}>대사관과 제출 기관에 따라 세부 기준이 달라질 수 있어요.</p>
    </>
  );
}
