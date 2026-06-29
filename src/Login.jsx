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
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fdf4ff 0%, #f3e8ff 50%, #fce7f3 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Nunito, sans-serif', padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo.png" alt="VitaShield" style={{ width: 72, height: 72, borderRadius: 20, objectFit: 'cover', marginBottom: 16, boxShadow: '0 8px 32px rgba(168,85,247,0.25)' }} />
          <h1 style={{ fontSize: '32px', fontWeight: '900', background: 'linear-gradient(135deg, #ec4899, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 6px' }}>
            VitaShield
          </h1>
          <p style={{ color: '#a855f7', fontSize: '14px', fontWeight: 700, margin: 0 }}>
            {isRegister ? 'Tao tai khoan phu huynh' : 'Dang nhap tai khoan phu huynh'}
          </p>
        </div>

        {/* Form */}
        <div style={{
          background: 'white', borderRadius: '24px',
          padding: '32px', boxShadow: '0 20px 60px rgba(168,85,247,0.15)',
          border: '1.5px solid #f3e8ff'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#7e22ce', display: 'block', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%', background: '#fdf4ff', border: '1.5px solid #e9d5ff',
                  borderRadius: '12px', padding: '12px 16px', color: '#3b1f5e',
                  fontSize: '14px', outline: 'none', fontFamily: 'Nunito, sans-serif',
                  fontWeight: 600, boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#7e22ce', display: 'block', marginBottom: 6 }}>Mat khau</label>
              <input
                type="password"
                placeholder="It nhat 6 ky tu"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{
                  width: '100%', background: '#fdf4ff', border: '1.5px solid #e9d5ff',
                  borderRadius: '12px', padding: '12px 16px', color: '#3b1f5e',
                  fontSize: '14px', outline: 'none', fontFamily: 'Nunito, sans-serif',
                  fontWeight: 600, boxSizing: 'border-box'
                }}
              />
            </div>

            {error && (
              <div style={{ background: '#fce7f3', border: '1px solid #fbcfe8', borderRadius: 10, padding: '10px 14px', color: '#be185d', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                background: loading ? '#e9d5ff' : 'linear-gradient(135deg, #ec4899, #a855f7)',
                color: 'white', border: 'none', borderRadius: '14px',
                padding: '14px', fontSize: '15px', fontWeight: '800',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Nunito, sans-serif', marginTop: 4,
                boxShadow: loading ? 'none' : '0 4px 20px rgba(168,85,247,0.35)',
                transition: 'all 0.2s'
              }}
            >
              {loading ? '⏳ Dang xu ly...' : isRegister ? '✨ Dang ky ngay' : '💜 Dang nhap'}
            </button>

            <button
              onClick={() => { setIsRegister(!isRegister); setError('') }}
              style={{
                background: 'transparent', border: 'none', color: '#a855f7',
                fontSize: '13px', cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
                fontWeight: 700, padding: '4px'
              }}
            >
              {isRegister ? 'Da co tai khoan? Dang nhap' : 'Chua co tai khoan? Dang ky ngay'}
            </button>

            {/* Links huong dan */}
            <div style={{ borderTop: '1px solid #f3e8ff', paddingTop: 14, display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              
                href="https://drive.google.com/file/d/1sKefULl3b4_dal3wMeBN26nd13ttdEe9/view?usp=drive_link"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#a855f7', fontSize: '12px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                📖 Huong dan su dung
              </a>
              <span style={{ color: '#e9d5ff', fontSize: '12px' }}>|</span>
              
                href="https://drive.google.com/file/d/1sKefULl3b4_dal3wMeBN26nd13ttdEe9/view?usp=drive_link"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#a855f7', fontSize: '12px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                🔧 Huong dan cai dat
              </a>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#c084fc', fontSize: '12px', marginTop: 20, fontWeight: 600 }}>
          Bao ve con bang Tri tue - Xay dung bang Trai tim 💜
        </p>

      </div>
    </div>
  )
}