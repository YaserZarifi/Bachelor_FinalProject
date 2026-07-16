import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

/**
 * Request a device fix for a report. A valid report needs precise GPS, but a
 * high-accuracy fix can take a long time (or never resolve) indoors — so we
 * race it against a timeout and fall back to the last known position, rather
 * than leaving the user stuck on a spinner forever.
 */
export function useLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error(
          'دسترسی به موقعیت مکانی رد شد. برای ثبت گزارش معتبر، اجازهٔ دسترسی لازم است.'
        );
      }

      const toValue = (pos) => ({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        at: new Date(pos.timestamp).toISOString(),
      });

      // Race a balanced fix against a 12s timeout so weak GPS can't hang the flow.
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('__timeout__')), 12000)
      );
      let pos;
      try {
        pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          timeout,
        ]);
      } catch (raceErr) {
        // On timeout, accept a recent cached fix if the OS has one.
        const last = await Location.getLastKnownPositionAsync({ maxAge: 120000 });
        if (last) pos = last;
        else if (raceErr?.message === '__timeout__') {
          throw new Error(
            'دریافت موقعیت طول کشید. لطفاً در فضای باز و با GPS روشن دوباره تلاش کنید.'
          );
        } else throw raceErr;
      }

      const value = toValue(pos);
      setLoading(false);
      return value;
    } catch (e) {
      const msg = e?.message || 'دریافت موقعیت مکانی ناموفق بود. لطفاً دوباره تلاش کنید.';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }
  }, []);

  return { request, loading, error };
}
