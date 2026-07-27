import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

/**
 * Request a *satellite-grade* device fix for a report.
 *
 * A VPN cannot move a real GNSS fix — it only poisons location providers that
 * fall back to guessing from the IP address. So instead of trying to detect the
 * VPN, we insist on a fix that is too sharp to have come from an IP lookup:
 *
 *   GNSS               3 – 30 m
 *   Wi-Fi / cell       20 – 3000 m
 *   IP / VPN exit node 5000 m and up   ← always rejected
 *
 * `Accuracy.Highest` pins the request to the GNSS provider rather than the
 * fused "balanced" provider, and we watch the stream so an early coarse fix can
 * be refined before we commit. Mocked positions (fake-GPS apps) are refused
 * outright — Android reports these via `coords.mocked`.
 */

/** Resolve immediately at or below this radius — this is a real GNSS fix. */
export const GOOD_ACCURACY_M = 50;
/** Hard ceiling. Anything coarser is a network/IP guess and is never accepted. */
export const MAX_ACCURACY_M = 200;
/** How long to keep refining before settling for the best fix seen so far. */
const ACQUIRE_TIMEOUT_MS = 20000;

const isMocked = (pos) => pos?.mocked === true || pos?.coords?.mocked === true;

const toValue = (pos) => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
  at: new Date(pos.timestamp).toISOString(),
});

export function useLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null); // best accuracy seen, in metres

  const request = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress(null);

    let subscription = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error(
          'دسترسی به موقعیت مکانی رد شد. برای ثبت گزارش معتبر، اجازهٔ دسترسی لازم است.'
        );
      }

      // Without the OS location service the provider can only guess from the
      // network, which is exactly the reading a VPN corrupts.
      if (!(await Location.hasServicesEnabledAsync())) {
        throw new Error(
          'سرویس موقعیت‌مکانی (GPS) دستگاه خاموش است. لطفاً آن را روشن کنید و دوباره تلاش کنید.'
        );
      }

      let best = null;

      const fix = await new Promise((resolve, reject) => {
        let settled = false;
        const done = (fn, payload) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          fn(payload);
        };

        const timer = setTimeout(() => {
          if (best && best.coords.accuracy <= MAX_ACCURACY_M) done(resolve, best);
          else if (best) {
            done(
              reject,
              new Error(
                `موقعیت دریافت‌شده دقیق نیست (خطای ±${Math.round(
                  best.coords.accuracy
                ).toLocaleString('fa-IR')} متر) و احتمالاً به‌جای GPS از روی شبکه تخمین زده شده است. ` +
                  'اگر VPN روشن است آن را خاموش کنید، در فضای باز بایستید و دوباره تلاش کنید.'
              )
            );
          } else {
            done(
              reject,
              new Error(
                'دریافت موقعیت طول کشید. لطفاً در فضای باز و با GPS روشن دوباره تلاش کنید.'
              )
            );
          }
        }, ACQUIRE_TIMEOUT_MS);

        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Highest, distanceInterval: 0, timeInterval: 1000 },
          (pos) => {
            if (isMocked(pos)) {
              done(
                reject,
                new Error(
                  'موقعیت جعلی (Mock Location) روی دستگاه فعال است. برای ثبت گزارش معتبر باید آن را غیرفعال کنید.'
                )
              );
              return;
            }
            const acc = pos.coords.accuracy;
            if (best && best.coords.accuracy <= acc) return;
            best = pos;
            setProgress(acc);
            if (acc <= GOOD_ACCURACY_M) done(resolve, pos);
          }
        )
          .then((sub) => {
            subscription = sub;
            if (settled) sub.remove();
          })
          .catch((e) => done(reject, e));
      });

      setLoading(false);
      return toValue(fix);
    } catch (e) {
      // A cached OS fix is an acceptable fallback only if it is GNSS-grade and
      // unmocked — otherwise we would smuggle back in the reading we just refused.
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 120000 });
        if (last && !isMocked(last) && last.coords.accuracy <= MAX_ACCURACY_M) {
          setLoading(false);
          return toValue(last);
        }
      } catch {
        /* no cached fix available */
      }
      const msg = e?.message || 'دریافت موقعیت مکانی ناموفق بود. لطفاً دوباره تلاش کنید.';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    } finally {
      subscription?.remove();
    }
  }, []);

  return { request, loading, error, progress };
}
