'use client'

import { createContext, useContext, type ReactNode } from 'react'

const AdminContext = createContext<{ password: string }>({ password: '' })

export function useAdmin() {
  return useContext(AdminContext)
}

export default function AdminProvider({
  password,
  children,
}: {
  password: string
  children: ReactNode
}) {
  return (
    <AdminContext.Provider value={{ password }}>
      {children}
    </AdminContext.Provider>
  )
}
