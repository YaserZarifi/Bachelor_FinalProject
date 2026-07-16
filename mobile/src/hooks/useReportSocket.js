import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { wsBaseUrl, getAccessToken } from '../api/client';

/**
 * Subscribe to a single report's live updates over the Channels WebSocket.
 * Authenticates with the JWT access token or a guest token. Reconnects with
 * exponential backoff on drop and re-opens when the app returns to foreground,
 * so live status survives wifi blips and backgrounding.
 * Calls onUpdate({ status, is_urgent, updated_at }) on each change.
 */
export function useReportSocket(reportId, guestToken, onUpdate) {
  const [live, setLive] = useState(false);
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;

  useEffect(() => {
    if (!reportId) return undefined;
    let cancelled = false;
    let ws;
    let attempt = 0;
    let timer;

    async function connect() {
      if (cancelled) return;
      const access = await getAccessToken();
      if (cancelled) return;
      const qs = new URLSearchParams();
      if (access) qs.set('access', access);
      else if (guestToken) qs.set('guest_token', guestToken);

      try {
        ws = new WebSocket(`${wsBaseUrl()}/ws/reports/${reportId}/?${qs.toString()}`);
      } catch {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setLive(true);
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data && data.status && cbRef.current) cbRef.current(data);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        setLive(false);
        scheduleReconnect();
      };
      ws.onerror = () => {
        try {
          ws && ws.close();
        } catch {
          /* noop */
        }
      };
    }

    function scheduleReconnect() {
      if (cancelled) return;
      attempt += 1;
      timer = setTimeout(connect, Math.min(1000 * 2 ** attempt, 15000));
    }

    connect();

    // Re-open promptly when returning to foreground (socket may have died).
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && (!ws || ws.readyState > 1)) {
        clearTimeout(timer);
        attempt = 0;
        connect();
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.remove();
      try {
        ws && ws.close();
      } catch {
        /* noop */
      }
    };
  }, [reportId, guestToken]);

  return { live };
}
