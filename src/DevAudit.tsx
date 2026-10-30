import { useEffect, useState } from 'react';
import { observePerformance } from './performance';
export default function DevAudit() {
  const [data, setData] = useState<any>();
  useEffect(() => observePerformance(setData), []);
  return (
    <details className="dev-audit">
      <summary>Audit local</summary>
      <output>
        {data
          ? `LCP ${data.lcpMs === null ? 'non mesuré' : Math.round(data.lcpMs) + ' ms'} · CLS ${data.cls === null ? 'non mesuré' : data.cls.toFixed(4)} · INP ${data.inpMs === null ? 'interaction requise' : Math.round(data.inpMs) + ' ms'} · Three ${data.threeLoaded ? 'chargé' : 'absent'}`
          : 'Mesure…'}
      </output>
      <p>
        Mesures Web Vitals de ce navigateur local, sans envoi de données. Elles ne remplacent pas
        les résultats de terrain.
      </p>
    </details>
  );
}
