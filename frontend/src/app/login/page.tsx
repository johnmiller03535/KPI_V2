'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [login, setLogin]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e?: React.FormEvent | React.KeyboardEvent) {
    e?.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { login, password })
      localStorage.setItem('access_token', res.data.access_token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      router.push('/dashboard')
    } catch (err: any) {
      console.log('Login error:', err.response?.status, err.response?.data)
      setError(err.response?.data?.detail || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '20px',
      position: 'relative',
    }}>
      <div className="orb1" />
      <div className="orb2" />

      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24, padding: '48px 40px',
        width: '100%', maxWidth: 420,
        position: 'relative', overflow: 'hidden', zIndex: 1,
      }}>
        {/* Полоска сверху */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: '#00e5ff',
          boxShadow: '0 0 20px rgba(0,229,255,0.5)',
        }} />

        {/* Лого */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 900, fontSize: 22,
            letterSpacing: 4, color: '#00e5ff',
            textShadow: '0 0 30px rgba(0,229,255,0.5)',
            textTransform: 'uppercase',
          }}>
            KPI ПОРТАЛ
          </div>
          <div style={{
            fontSize: 12, color: 'rgba(232,234,246,0.5)',
            marginTop: 8, letterSpacing: 0.5,
            fontFamily: 'Exo 2, sans-serif',
          }}>
            ГКУ МО «Региональный центр торгов»
          </div>
        </div>

        {/* Разделитель */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '28px 0' }} />

        <div>
          <div style={{ marginBottom: 20 }}>
            <label className="login-label">Логин (Redmine)</label>
            <input
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(e as any) }}
              required
              autoComplete="username"
              className="login-input"
              placeholder="username"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="login-label">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(e as any) }}
              required
              autoComplete="current-password"
              className="login-input"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,59,92,0.1)',
              border: '1px solid rgba(255,59,92,0.3)',
              borderRadius: 8, padding: '10px 14px',
              color: '#ff3b5c', fontSize: 13,
              marginBottom: 20,
              fontFamily: 'Exo 2, sans-serif',
            }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '14px',
              background: loading
                ? 'rgba(255,255,255,0.04)'
                : 'linear-gradient(135deg, rgba(0,229,255,0.2), rgba(0,229,255,0.05))',
              border: `1px solid ${loading ? 'rgba(255,255,255,0.1)' : 'rgba(0,229,255,0.4)'}`,
              color: loading ? 'rgba(232,234,246,0.3)' : '#00e5ff',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 12, letterSpacing: 2,
              fontWeight: 700, borderRadius: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
            }}
            onMouseEnter={e => {
              if (!loading) {
                const el = e.currentTarget
                el.style.background = 'rgba(0,229,255,0.25)'
                el.style.boxShadow = '0 0 20px rgba(0,229,255,0.2)'
              }
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              if (!loading) {
                el.style.background = 'linear-gradient(135deg, rgba(0,229,255,0.2), rgba(0,229,255,0.05))'
                el.style.boxShadow = 'none'
              }
            }}
          >
            {loading ? 'ВХОД...' : 'ВОЙТИ'}
          </button>
        </div>
      </div>
    </div>
  )
}
