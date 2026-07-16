import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, CameraOff, Aperture, RotateCcw, ShieldCheck, MapPin } from 'lucide-react'
import { useGeolocation } from '../hooks/useGeolocation'
import { computeCaptureHash } from '../api/integrity'

/**
 * In-app camera: the only way to attach an image to a report.
 *
 * Why not a normal file input? Gallery uploads carry editable metadata and let a
 * user attach a photo taken anywhere, anytime — which defeats trust. Here the
 * photo is taken live from the device camera and bound, at the same instant, to
 * the device GPS reading + a timestamp + an integrity digest. The result is a
 * tamper-evident "capture package" the rest of the app treats as the evidence.
 *
 * onCapture receives:
 *   { blob, previewUrl, lat, lng, accuracy, capturedAt, integrityHash }
 */
export function CameraCapture({ onCapture, onClear, captured }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const geo = useGeolocation()

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setActive(false)
  }, [])

  // Always release the camera when the component unmounts.
  useEffect(() => stopStream, [stopStream])

  // Attach the stream once the <video> element is actually mounted. Doing this
  // in an effect (rather than inside startCamera) avoids a race where the live
  // view hasn't rendered yet — notably on "retake".
  useEffect(() => {
    const video = videoRef.current
    if (active && video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current
      video.play().catch(() => {})
    }
  }, [active])

  async function startCamera() {
    setError('')
    setStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setActive(true)
    } catch (err) {
      setError(
        err?.name === 'NotAllowedError'
          ? 'دسترسی به دوربین رد شد. برای ثبت گزارش معتبر، اجازهٔ دوربین لازم است.'
          : 'دوربین در دسترس نیست. لطفاً از دستگاهی با دوربین استفاده کنید.',
      )
    } finally {
      setStarting(false)
    }
  }

  async function snap() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setBusy(true)
    setError('')
    try {
      // 1) Read the real device location *now*, at the moment of capture.
      const loc = await geo.request()

      // 2) Freeze the current video frame to a JPEG blob.
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      )
      if (!blob) throw new Error('encode-failed')

      // 3) Bind image + location + timestamp into one tamper-evident package.
      const capturedAt = new Date().toISOString()
      const meta = { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, capturedAt }
      const integrityHash = await computeCaptureHash(blob, meta)

      stopStream()
      onCapture({
        blob,
        previewUrl: URL.createObjectURL(blob),
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        capturedAt,
        integrityHash,
      })
    } catch {
      setError(geo.error || 'ثبت تصویر ناموفق بود. لطفاً دوباره تلاش کنید.')
    } finally {
      setBusy(false)
    }
  }

  function retake() {
    if (captured?.previewUrl) URL.revokeObjectURL(captured.previewUrl)
    onClear()
    startCamera()
  }

  // ── Captured state: show the locked evidence ────────────────────────────
  if (captured) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-3"
      >
        <div className="relative overflow-hidden rounded-2xl border border-civic-400/40 shadow-card">
          <img
            src={captured.previewUrl}
            alt="تصویر ثبت‌شده"
            className="h-64 w-full object-cover"
          />
          <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-civic-500/90 px-3 py-1 text-xs font-bold text-white backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" />
            معتبر
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-xs text-white">
            <div className="flex items-center gap-2 font-semibold">
              <span className="flex h-2 w-2 rounded-full bg-civic-400" />
              تصویر معتبر دوربین — موقعیت قفل‌شده
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 opacity-90">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                دقت ±{Math.round(captured.accuracy).toLocaleString('fa-IR')} متر
              </span>
              <span>{new Date(captured.capturedAt).toLocaleString('fa-IR')}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={retake}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-beacon-600 transition hover:text-beacon-700 dark:text-beacon-400"
        >
          <RotateCcw className="h-4 w-4" />
          ثبت دوبارهٔ تصویر
        </button>
      </motion.div>
    )
  }

  // ── Live camera / start state ───────────────────────────────────────────
  return (
    <div className="space-y-3">
      <p className="inline-flex items-start gap-2 text-xs font-semibold text-coral-600 dark:text-coral-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        برای تأیید اعتبار گزارش، تصویر باید همین حالا با دوربین ثبت شود. آپلود از گالری ممکن
        نیست.
      </p>

      <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-ink-950 dark:border-white/10">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${active ? '' : 'hidden'}`}
        />

        {/* Viewfinder corner accents while live */}
        {active && (
          <>
            <span className="pointer-events-none absolute left-4 top-4 h-7 w-7 rounded-tl-xl border-l-2 border-t-2 border-civic-400/80" />
            <span className="pointer-events-none absolute right-4 top-4 h-7 w-7 rounded-tr-xl border-r-2 border-t-2 border-civic-400/80" />
            <span className="pointer-events-none absolute bottom-4 left-4 h-7 w-7 rounded-bl-xl border-b-2 border-l-2 border-civic-400/80" />
            <span className="pointer-events-none absolute bottom-4 right-4 h-7 w-7 rounded-br-xl border-b-2 border-r-2 border-civic-400/80" />
            <motion.span
              className="pointer-events-none absolute inset-x-6 h-0.5 rounded-full bg-civic-400/70 shadow-[0_0_12px_2px_rgba(16,185,129,0.6)]"
              initial={{ top: '12%' }}
              animate={{ top: ['12%', '88%', '12%'] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}

        {!active && (
          <div className="px-6 text-center text-slate-300">
            <CameraOff className="mx-auto mb-3 h-12 w-12 opacity-70" />
            <p className="text-sm">دوربین خاموش است</p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-coral-400/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-600 dark:text-coral-300">
          {error}
        </div>
      )}

      {!active ? (
        <button
          type="button"
          onClick={startCamera}
          disabled={starting}
          className="btn-primary w-full"
        >
          <Camera className="h-5 w-5" />
          {starting ? 'در حال روشن کردن دوربین…' : 'روشن کردن دوربین'}
        </button>
      ) : (
        <button type="button" onClick={snap} disabled={busy} className="btn-civic w-full">
          <Aperture className="h-5 w-5" />
          {busy ? 'در حال ثبت و قفل موقعیت…' : 'ثبت تصویر و موقعیت'}
        </button>
      )}
    </div>
  )
}
