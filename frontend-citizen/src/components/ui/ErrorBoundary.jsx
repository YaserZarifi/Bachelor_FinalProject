import { Component } from 'react'
import { AlertOctagon, RotateCcw } from 'lucide-react'

/** Catches render errors so a single throw can't white-screen the whole app. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Surface for debugging; a real deployment would report this upstream.
    console.error('UI error boundary caught:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-coral-100 text-coral-600 dark:bg-coral-500/15 dark:text-coral-400">
          <AlertOctagon size={30} />
        </div>
        <h1 className="text-2xl font-black text-ink-900 dark:text-white">
          خطایی رخ داد
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          صفحه به مشکلی برخورد کرد. بارگذاری دوباره معمولاً مشکل را برطرف می‌کند.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary mt-6"
        >
          <RotateCcw size={18} />
          بارگذاری دوباره
        </button>
      </div>
    )
  }
}
