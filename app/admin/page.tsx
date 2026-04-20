'use client'

import { useState } from 'react'

type Registration = {
  id: number
  first_name: string
  last_name: string
  email: string
  email_verified: boolean
  admin_approved: boolean
  created_at: string
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchRegistrations = async (pwd: string) => {
    setLoading(true)
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setRegistrations(data.data)
      setAuthed(true)
      setAuthError('')
    } else {
      setAuthError('Wrong password.')
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    fetchRegistrations(password)
  }

  const handleApprove = async (id: number) => {
    setActionLoading(id)
    await fetch('/api/admin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, id }),
    })
    await fetchRegistrations(password)
    setActionLoading(null)
  }

  const handleReject = async (id: number) => {
    setActionLoading(id)
    await fetch('/api/admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, id }),
    })
    await fetchRegistrations(password)
    setActionLoading(null)
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full">
          <div className="flex justify-center mb-8">
            <img src="/smashpadel_logo.png" alt="Smash Padel" width={80} height={80} className="rounded-full" />
          </div>
          <h1 className="text-xl font-bold text-black mb-6 text-center">Admin Panel</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-black"
              />
            </div>
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold text-white rounded"
              style={{ backgroundColor: '#ff6b35' }}
            >
              Login
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white p-6 sm:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <img src="/smashpadel_logo.png" alt="Smash Padel" width={50} height={50} className="rounded-full" />
            <h1 className="text-xl font-bold text-black">Admin Panel</h1>
          </div>
          <button
            onClick={() => { setAuthed(false); setPassword('') }}
            className="text-sm text-gray-500 hover:text-black"
          >
            Logout
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Total: <strong>{registrations.length}</strong> &nbsp;|&nbsp;
          Approved: <strong>{registrations.filter(r => r.admin_approved && r.email_verified).length}</strong> &nbsp;|&nbsp;
          Pending: <strong>{registrations.filter(r => !r.admin_approved).length}</strong>
        </p>

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : registrations.length === 0 ? (
          <p className="text-sm text-gray-400">No registrations yet.</p>
        ) : (
          <div className="space-y-3">
            {registrations.map(r => (
              <div
                key={r.id}
                className="border border-gray-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-black">{r.first_name} {r.last_name}</p>
                  <p className="text-sm text-gray-500">{r.email}</p>
                  <div className="flex gap-3 mt-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.email_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {r.email_verified ? 'Email Verified' : 'Email Pending'}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.admin_approved ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {r.admin_approved ? 'Approved' : 'Not Approved'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!r.admin_approved && (
                    <button
                      onClick={() => handleApprove(r.id)}
                      disabled={actionLoading === r.id}
                      className="px-4 py-1.5 text-xs font-semibold text-white rounded disabled:opacity-50"
                      style={{ backgroundColor: '#ff6b35' }}
                    >
                      {actionLoading === r.id ? '...' : 'Approve'}
                    </button>
                  )}
                  <button
                    onClick={() => handleReject(r.id)}
                    disabled={actionLoading === r.id}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-gray-800 rounded disabled:opacity-50 hover:bg-black"
                  >
                    {actionLoading === r.id ? '...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
