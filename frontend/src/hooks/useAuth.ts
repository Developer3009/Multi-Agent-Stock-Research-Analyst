import { useState, useEffect, useCallback } from 'react'
import { authAPI } from '../api/client'
import type { User } from '../types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    authAPI
      .me()
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authAPI.login(email, password)
    localStorage.setItem('token', res.data.access_token)
    const me = await authAPI.me()
    setUser(me.data)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    await authAPI.register(email, password)
    await login(email, password)
  }, [login])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
  }, [])

  return { user, loading, login, register, logout }
}
