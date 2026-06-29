import { useState } from 'react'
import { auth } from './firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password)
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_email: email,
            parent_name: email.split('@')[0],
            child_name: 'Chua co',
            blocked_url: 'Chao mung ban den voi VitaShield!',
            device_name: 'VitaShield'
          })
        }).catch(() => {})
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      onLogin()
    } catch (e) {
      if (e.message.includes('invalid')) setError('Email hoac mat khau khong dung')
      else if (e.message.includes('weak')) setError('Mat khau can it nhat 6 ky tu')
      else setError('Da co loi xay ra, thu lai nhe')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#161b27', border: '1px solid #1e2535',
        borderRadius: '20px', padding: '40px', width: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px' }}>🛡️</div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            VitaShield
          </h1>
          <p style={{ color: '#64748b', marginTop: '6px', fontSize: '14px' }}>
            {isRegister ? 'Tao tai khoan phu huynh' : 'Dang nhap tai khoan phu huynh'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="email"
            placeholder="Email cua ban"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              background: '#0f1117', border: '1px solid #1e2535',
              borderRadius: '10px', padding: '12px 16px',
              color: '#e2e8f0', fontSize: '14px', outline: 'none'
            }}
          />
          <input
            type="password"
            placeholder="Mat khau (it nhat 6 ky tu)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{
              background: '#0f1117', border: '1px solid #1e2535',
              borderRadius: '10px', padding: '12px 16px',
              color: '#e2e8f0', fontSize: '14px', outline: 'none'
            }}
          />
          {error && (
            <p style={{ color: '#f87171', fontSize: '13px', textAlign: 'center' }}>{error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white', border: 'none', borderRadius: '10px',
              padding: '13px', fontSize: '15px', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? '⏳ Dang xu ly...' : isRegister ? 'Dang ky' : 'Dang nhap'}
          </button>
          <button
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            style={{
              background: 'transparent', border: 'none',
              color: '#6366f1', fontSize: '13px', cursor: 'pointer'
            }}
          >
            {isRegister ? 'Da co tai khoan? Dang nhap' : 'Chua co tai khoan? Dang ky ngay'}
          </button>
        </div>
      </div>
    </div>
  )
}