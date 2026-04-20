'use client'

import { useState } from 'react'
import { supabase, type Registration } from '@/lib/supabase'
import { User, Phone, Mail, ChevronDown, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

type FormData = Omit<Registration, 'id' | 'created_at'>

const initialForm: FormData = {
  name: '',
  surname: '',
  phone: '',
  email: '',
  partner_name: '',
  partner_surname: '',
  partner_phone: '',
  partner_email: '',
  level: 'intermediate',
  category: 'mixed',
  notes: '',
}

export default function RegistrationForm() {
  const [form, setForm] = useState<FormData>(initialForm)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const { error } = await supabase.from('registrations').insert([form])

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('success')
      setForm(initialForm)
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h3 className="text-2xl font-bold text-gray-800">Kaydınız Alındı!</h3>
        <p className="text-gray-600 max-w-sm">
          Turnuvaya başarıyla kaydoldunuz. En kısa sürede sizinle iletişime geçeceğiz.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Yeni Kayıt Yap
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Oyuncu 1 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-green-600" />
          1. Oyuncu (Siz)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad *</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Adınız"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Soyad *</label>
            <input
              type="text"
              name="surname"
              value={form.surname}
              onChange={handleChange}
              required
              placeholder="Soyadınız"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> Telefon *
            </label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              required
              placeholder="05XX XXX XX XX"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> E-posta *
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="ornek@mail.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
          </div>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Oyuncu 2 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" />
          2. Oyuncu (Partneriniz)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad *</label>
            <input
              type="text"
              name="partner_name"
              value={form.partner_name}
              onChange={handleChange}
              required
              placeholder="Partnerinizin adı"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Soyad *</label>
            <input
              type="text"
              name="partner_surname"
              value={form.partner_surname}
              onChange={handleChange}
              required
              placeholder="Partnerinizin soyadı"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> Telefon *
            </label>
            <input
              type="tel"
              name="partner_phone"
              value={form.partner_phone}
              onChange={handleChange}
              required
              placeholder="05XX XXX XX XX"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> E-posta *
            </label>
            <input
              type="email"
              name="partner_email"
              value={form.partner_email}
              onChange={handleChange}
              required
              placeholder="ornek@mail.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
          </div>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Kategori & Seviye */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
          <div className="relative">
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white"
            >
              <option value="mixed">Karışık</option>
              <option value="male">Erkekler</option>
              <option value="female">Kadınlar</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seviye *</label>
          <div className="relative">
            <select
              name="level"
              value={form.level}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white"
            >
              <option value="beginner">Başlangıç</option>
              <option value="intermediate">Orta</option>
              <option value="advanced">İleri</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Notlar */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Eklemek İstedikleriniz</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={3}
          placeholder="Eklemek istediğiniz not veya özel talepleriniz..."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition resize-none"
        />
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Bir hata oluştu: {errorMsg}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Kaydediliyor...
          </>
        ) : (
          'Turnuvaya Kayıt Ol'
        )}
      </button>
    </form>
  )
}
