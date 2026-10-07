'use client'

import { useEffect, useRef, useState } from 'react'

type Registration = {
  id: string
  first_name: string
  last_name: string
  email: string
  checked_in: boolean
  checked_in_at: string | null
}

type ScanResult =
  | { kind: 'idle' }
  | { kind: 'pending'; registration: Registration }
  | { kind: 'already'; registration: Registration }
  | { kind: 'success'; registration: Registration }
  | { kind: 'error'; message: string }

export default function AdminScanPage() {
  const [list, setList] = useState<Registration[]>([])
  const [scanResult, setScanResult] = useState<ScanResult>({ kind: 'idle' })
  const [scanning, setScanning] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const scannerRef = useRef<any>(null)
  const scannerDivId = 'qr-scanner-region'
  const lastScanRef = useRef<string>('')
  const lastScanAtRef = useRef<number>(0)

  const fetchList = async () => {
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    if (res.ok) {
      setList(data.data)
    }
  }

  useEffect(() => {
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parseQr = (raw: string): string | null => {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.id !== 'undefined') return String(parsed.id)
    } catch {}
    // Fallback: raw id
    if (/^[a-zA-Z0-9-]+$/.test(raw)) return raw
    return null
  }

  const handleScanValue = async (raw: string) => {
    const now = Date.now()
    if (raw === lastScanRef.current && now - lastScanAtRef.current < 3000) return
    lastScanRef.current = raw
    lastScanAtRef.current = now

    const id = parseQr(raw)
    if (!id) {
      setScanResult({ kind: 'error', message: 'Invalid QR code.' })
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()

      if (!res.ok) {
        setScanResult({ kind: 'error', message: data.error || 'Failed to check in.' })
      } else if (data.alreadyCheckedIn) {
        setScanResult({ kind: 'already', registration: data.registration })
      } else if (data.success) {
        setScanResult({ kind: 'success', registration: data.registration })
        fetchList()
      }
    } catch {
      setScanResult({ kind: 'error', message: 'Network error.' })
    } finally {
      setActionLoading(false)
    }
  }

  const startScanner = async () => {
    setScanResult({ kind: 'idle' })
    setScanning(true)
    try {
      // Dynamic import so it only loads in the browser
      const mod = await import('html5-qrcode')
      const Html5Qrcode = mod.Html5Qrcode
      const scanner = new Html5Qrcode(scannerDivId)
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        decoded => {
          handleScanValue(decoded)
        },
        () => {
          /* decode error per frame — ignore */
        }
      )
    } catch (err: any) {
      setScanning(false)
      setScanResult({
        kind: 'error',
        message: err?.message || 'Could not access camera. Grant camera permission and try again.',
      })
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      } catch {}
      scannerRef.current = null
    }
    setScanning(false)
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const total = list.length
  const checkedInCount = list.filter(r => r.checked_in).length

  return (
    <main className="min-h-dvh bg-background p-6 sm:p-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src="/smashpadel_logo.png" alt="Smash Padel" width={44} height={44} className="rounded-full" />
            <h1 className="font-display text-lg font-bold text-foreground">Check-In Scanner</h1>
          </div>
          <a href="/admin" className="text-sm text-subtle hover:text-foreground">← Back to Admin</a>
        </div>

        <div className="mb-5 text-sm text-foreground/85">
          <strong>{checkedInCount}</strong> / {total} checked in
        </div>

        {/* Scanner */}
        <div className="mb-4">
          {!scanning ? (
            <button
              onClick={startScanner}
              className="min-h-12 w-full rounded-xl bg-primary font-display text-lg font-semibold text-primary-foreground shadow-cta transition-colors hover:bg-primary-hover active:bg-primary-pressed"
            >
              📷 Start scanner
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="min-h-12 w-full rounded-xl border border-border-strong font-display text-lg font-semibold transition-colors hover:bg-white/5"
            >
              Stop Scanner
            </button>
          )}
        </div>

        <div
          id={scannerDivId}
          className={`rounded-lg overflow-hidden ${scanning ? 'mb-5' : 'hidden'}`}
          style={{ minHeight: scanning ? 280 : 0, background: '#000' }}
        />

        {/* Scan result banner */}
        {scanResult.kind !== 'idle' && (
          <div
            className="mb-6 rounded-lg p-4 border"
            style={{
              backgroundColor:
                scanResult.kind === 'success'
                  ? 'rgb(95 208 138 / 0.12)'
                  : scanResult.kind === 'already'
                  ? 'rgb(200 232 102 / 0.12)'
                  : 'rgb(242 118 106 / 0.12)',
              borderColor:
                scanResult.kind === 'success'
                  ? '#10b981'
                  : scanResult.kind === 'already'
                  ? '#eab308'
                  : '#ef4444',
            }}
          >
            {scanResult.kind === 'success' && (
              <>
                <p className="text-lg font-bold text-foreground">
                  ✅ {scanResult.registration.first_name} {scanResult.registration.last_name} checked in!
                </p>
                <p className="text-sm text-muted-foreground mt-1">{scanResult.registration.email}</p>
              </>
            )}
            {scanResult.kind === 'already' && (
              <>
                <p className="text-lg font-bold text-foreground">
                  ⚠️ {scanResult.registration.first_name} {scanResult.registration.last_name} already checked in
                </p>
                <p className="text-sm text-muted-foreground mt-1">{scanResult.registration.email}</p>
              </>
            )}
            {scanResult.kind === 'error' && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-1">Error</p>
                <p className="text-sm text-foreground">{scanResult.message}</p>
              </>
            )}
            {actionLoading && <p className="text-xs text-subtle mt-2">Processing...</p>}
          </div>
        )}

        {/* Checked-in list */}
        <h2 className="font-display text-sm font-semibold text-foreground mb-3">Checked In</h2>
        {list.filter(r => r.checked_in).length === 0 ? (
          <p className="text-sm text-subtle">No check-ins yet.</p>
        ) : (
          <ul className="space-y-2">
            {list
              .filter(r => r.checked_in)
              .map(r => (
                <li
                  key={r.id}
                  className="border border-border-strong rounded-lg px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {r.first_name} {r.last_name}
                    </p>
                    <p className="text-xs text-subtle">{r.email}</p>
                  </div>
                  <span className="text-xs text-subtle">
                    {r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString() : ''}
                  </span>
                </li>
              ))}
          </ul>
        )}

        <h2 className="font-display text-sm font-semibold text-foreground mt-8 mb-3">Pending</h2>
        {list.filter(r => !r.checked_in).length === 0 ? (
          <p className="text-sm text-subtle">Everyone is in.</p>
        ) : (
          <ul className="space-y-2">
            {list
              .filter(r => !r.checked_in)
              .map(r => (
                <li key={r.id} className="border border-border-strong rounded-lg px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">
                    {r.first_name} {r.last_name}
                  </p>
                  <p className="text-xs text-subtle">{r.email}</p>
                </li>
              ))}
          </ul>
        )}
      </div>
    </main>
  )
}
