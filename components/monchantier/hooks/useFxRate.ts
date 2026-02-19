import { useEffect, useState } from "react";

export function useFxRate() {
  const [fxRateUSDCDF, setFxRateUSDCDF] = useState<number | null>(null);
  const [fxLoading, setFxLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setFxLoading(true);
        const res = await fetch("/api/fx/usd-cdf");
        if (!res.ok) throw new Error("fx failed");
        const data = await res.json();
        if (typeof data?.rate === "number") setFxRateUSDCDF(data.rate);
      } catch {
        // silencieux — on garde le fallback
      } finally {
        setFxLoading(false);
      }
    })();
  }, []);

  return { fxRateUSDCDF, fxLoading };
}
