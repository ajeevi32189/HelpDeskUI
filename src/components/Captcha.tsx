import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import axios from 'axios'
import { authApi } from '../api/auth'

interface Props {
  /** Increment this value to reload the CAPTCHA (for example, after a failed sign-in). */
  reloadKey?: number
  onKey: (key: string) => void
}

export function Captcha({ reloadKey = 0, onKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [text, setText] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [manual, setManual] = useState(0)
  const [retryDelay, setRetryDelay] = useState(0)

  useEffect(() => {
    if (retryDelay <= 0) return
    const timer = window.setTimeout(() => setRetryDelay((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [retryDelay])

  useEffect(() => {
    let alive = true
    setState('loading')
    setErrorMessage('')
    setText('')
    onKey('')
    authApi
      .captcha()
      .then((d) => {
        if (!alive) return
        setText(d.captchaValue)
        onKey(d.captchaKey)
        setState('ready')
      })
      .catch((error: unknown) => {
        if (!alive) return
        onKey('')
        const rateLimited = axios.isAxiosError(error) && error.response?.status === 429
        setErrorMessage(rateLimited
          ? 'User Management CAPTCHA returned HTTP 429 (rate limited).'
          : 'Could not load CAPTCHA. Check your connection and refresh.')
        if (rateLimited) setRetryDelay(15)
        setState('error')
      })
    return () => {
      alive = false
    }
  }, [reloadKey, manual, onKey])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !text) return
    const { width: w, height: h } = canvas
    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, '#eef2ff')
    bg.addColorStop(1, '#e0e7ff')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = `rgba(79,70,229,${0.12 + Math.random() * 0.25})`
      ctx.beginPath()
      ctx.moveTo(Math.random() * w, Math.random() * h)
      ctx.lineTo(Math.random() * w, Math.random() * h)
      ctx.stroke()
    }
    const step = w / (text.length + 1)
    Array.from(text).forEach((ch, i) => {
      ctx.save()
      ctx.translate(step * (i + 1), h / 2 + (Math.random() * 8 - 4))
      ctx.rotate((Math.random() - 0.5) * 0.5)
      ctx.font = `bold ${26 + Math.random() * 6}px ui-monospace, Menlo, monospace`
      ctx.fillStyle = '#312e81'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ch, 0, 0)
      ctx.restore()
    })
  }, [text])

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex h-12 w-40 items-center justify-center overflow-hidden rounded-lg border border-line bg-indigo-50 dark:bg-indigo-500/10">
          {state === 'ready' ? (
            <canvas ref={canvasRef} width={160} height={48} />
          ) : (
            <span className="px-2 text-center text-xs text-slate-500">
              {state === 'loading' ? 'Loading…' : 'Could not load CAPTCHA'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setManual((n) => n + 1)}
          title="Refresh CAPTCHA"
          disabled={state === 'loading' || retryDelay > 0}
          className="rounded-lg border border-line p-2.5 text-subtle transition hover:bg-soft hover:text-ink disabled:cursor-wait disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${state === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {state === 'error' && (
        <p role="status" className="mt-1 text-xs text-red-600 dark:text-red-300">
          {errorMessage}{retryDelay > 0 ? ` Retry in ${retryDelay}s.` : ' Refresh to try again.'}
        </p>
      )}
    </div>
  )
}
