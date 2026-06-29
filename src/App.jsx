import { useState, useEffect } from 'react'
import './App.css'
import Login from './Login'
import { auth, db } from './firebase'
import { onAuthStateChanged, signOut, deleteUser } from 'firebase/auth'
import { doc, setDoc, getDoc, collection, onSnapshot, deleteDoc, query, where, getDocs, addDoc } from 'firebase/firestore'

function QRCode({ value }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(value)}`
  return <img src={url} alt="QR Code" style={{ width: 180, height: 180, borderRadius: 16 }} />
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedChild, setSelectedChild] = useState(null)
  const [children, setChildren] = useState([])
  const [alerts, setAlerts] = useState([])
  const [pairingCode, setPairingCode] = useState('')
  const [pairingExpiry, setPairingExpiry] = useState(null)
  const [pairingCountdown, setPairingCountdown] = useState(0)
  const [showQR, setShowQR] = useState(false)
  const [aiCoachOpen, setAiCoachOpen] = useState(false)
  const [aiCoachMsg, setAiCoachMsg] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bedtimeEnabled, setBedtimeEnabled] = useState(true)
  const [filterEnabled, setFilterEnabled] = useState(true)
  const [newBlockedUrl, setNewBlockedUrl] = useState('')
  const [blockedUrls, setBlockedUrls] = useState([])
  const [screenTimeLimit, setScreenTimeLimit] = useState(120)
  const [codeLoading, setCodeLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportSent, setReportSent] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!user) return
    const parentRef = doc(db, 'parents', user.uid)
    getDoc(parentRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        setBlockedUrls(data.blockedUrls || [])
        setBedtimeEnabled(data.bedtimeEnabled ?? true)
        setFilterEnabled(data.filterEnabled ?? true)
        setScreenTimeLimit(data.screenTimeLimit || 120)
      } else {
        setDoc(parentRef, { email: user.email, blockedUrls: [], bedtimeEnabled: true, filterEnabled: true, screenTimeLimit: 120 })
      }
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'devices'), where('parentId', '==', user.uid))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setChildren(list)
      if (list.length > 0 && !selectedChild) setSelectedChild(list[0])
    })
    return unsub
  }, [user])

  useEffect(() => {
    if (!user || !selectedChild) return
    const q = query(collection(db, 'logs'), where('parentId', '==', user.uid), where('deviceId', '==', selectedChild.id))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          if (a.blocked && !b.blocked) return -1
          if (!a.blocked && b.blocked) return 1
          return new Date(b.time) - new Date(a.time)
        }).slice(0, 50)
      setAlerts(list)
    })
    return unsub
  }, [user, selectedChild])

  useEffect(() => {
    if (!pairingExpiry) return
    const timer = setInterval(() => {
      const left = Math.max(0, Math.floor((new Date(pairingExpiry) - Date.now()) / 1000))
      setPairingCountdown(left)
      if (left === 0) {
        setPairingCode('')
        setPairingExpiry(null)
        clearInterval(timer)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [pairingExpiry])

  async function saveParentSettings(updates) {
    await setDoc(doc(db, 'parents', user.uid), updates, { merge: true })
  }

  async function regenerateCode() {
    setCodeLoading(true)
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      const oldQ = query(collection(db, 'pairingCodes'), where('parentId', '==', user.uid), where('used', '==', false))
      const oldSnap = await getDocs(oldQ)
      for (const d of oldSnap.docs) await deleteDoc(d.ref)
      await addDoc(collection(db, 'pairingCodes'), {
        code, parentId: user.uid,
        createdAt: new Date().toISOString(), expiresAt, used: false
      })
      setPairingCode(code)
      setPairingExpiry(expiresAt)
      setPairingCountdown(600)
    } catch (e) {
      alert('Loi tao ma: ' + e.message)
    }
    setCodeLoading(false)
  }

  async function addBlockedUrl() {
    if (!newBlockedUrl.trim()) return
    let url = newBlockedUrl.trim().toLowerCase()
    try {
      if (!url.startsWith('http')) url = 'https://' + url
      url = new URL(url).hostname.replace('www.', '')
    } catch {
      url = url.replace(/https?:\/\//, '').replace('www.', '').split('/')[0].split('?')[0]
    }
    if (!url) return
    if (blockedUrls.includes(url)) { setNewBlockedUrl(''); return }
    const updated = [...blockedUrls, url]
    setBlockedUrls(updated)
    setNewBlockedUrl('')
    await saveParentSettings({ blockedUrls: updated })
  }

  async function removeBlockedUrl(url) {
    const updated = blockedUrls.filter(u => u !== url)
    setBlockedUrls(updated)
    await saveParentSettings({ blockedUrls: updated })
  }

  async function toggleBedtime(val) {
    setBedtimeEnabled(val)
    await saveParentSettings({ bedtimeEnabled: val })
  }

  async function toggleFilter(val) {
    setFilterEnabled(val)
    await saveParentSettings({ filterEnabled: val })
  }

  async function updateScreenTimeLimit(val) {
    setScreenTimeLimit(val)
    await saveParentSettings({ screenTimeLimit: val })
  }

  async function removeDevice(deviceId) {
    await deleteDoc(doc(db, 'devices', deviceId))
    if (selectedChild?.id === deviceId) setSelectedChild(null)
  }

  async function handleDeleteAccount() {
    try {
      await deleteDoc(doc(db, 'parents', user.uid))
      const q = query(collection(db, 'devices'), where('parentId', '==', user.uid))
      const snap = await getDocs(q)
      for (const d of snap.docs) await deleteDoc(d.ref)
      const q2 = query(collection(db, 'logs'), where('parentId', '==', user.uid))
      const snap2 = await getDocs(q2)
      for (const d of snap2.docs) await deleteDoc(d.ref)
      const q3 = query(collection(db, 'pairingCodes'), where('parentId', '==', user.uid))
      const snap3 = await getDocs(q3)
      for (const d of snap3.docs) await deleteDoc(d.ref)
      await deleteUser(user)
    } catch (e) {
      alert('Loi: ' + e.message + '\nVui long dang xuat va dang nhap lai truoc khi xoa.')
    }
  }

  async function askAiCoach() {
    if (!aiCoachMsg.trim()) return
    setAiLoading(true)
    setAiResponse('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'coach', messages: [{ role: 'user', content: aiCoachMsg }] }),
      })
      const data = await res.json()
      setAiResponse(data.result || 'Xin loi, khong the ket noi AI.')
    } catch {
      setAiResponse('Khong the ket noi AI. Vui long thu lai.')
    }
    setAiLoading(false)
  }

  async function sendReport(type) {
    if (!user?.email || !child) return
    setReportLoading(true)
    setReportSent(false)
    const now = new Date()
    const blockedList = alerts.filter(a => a.blocked).slice(0, 5).map(a => a.url).join(', ') || 'Khong co'
    const summary = type === 'day'
      ? `Bao cao ngay ${now.toLocaleDateString('vi-VN')}: ${blockedCount} trang bi chan, ${safeCount} trang an toan, ${child?.screenTime || 0} phut man hinh. Top trang bi chan: ${blockedList}`
      : `Bao cao tuan ${now.toLocaleDateString('vi-VN')}: ${blockedCount} trang bi chan, ${safeCount} trang an toan, ${child?.screenTime || 0} phut man hinh. Top trang bi chan: ${blockedList}`
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: user.email,
          parent_name: user.email.split('@')[0],
          child_name: child?.childName || 'Con',
          blocked_url: summary,
          device_name: type === 'day' ? 'Bao cao ngay' : 'Bao cao tuan'
        })
      })
      setReportSent(true)
      setTimeout(() => setReportSent(false), 3000)
    } catch {}
    setReportLoading(false)
  }

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fdf4ff, #f3e8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <img src="/logo.png" alt="VitaShield" style={{ width: 80, borderRadius: 20, animation: 'spin 2s linear infinite' }} />
      <div style={{ color: '#a855f7', fontSize: '18px', fontWeight: '800', fontFamily: 'Nunito, sans-serif' }}>Dang tai VitaShield... 💜</div>
    </div>
  )

  if (!user) return <Login onLogin={() => {}} />

  const child = selectedChild
  const blockedCount = alerts.filter(a => a.blocked).length
  const safeCount = alerts.filter(a => !a.blocked).length
  const countdownMin = Math.floor(pairingCountdown / 60)
  const countdownSec = String(pairingCountdown % 60).padStart(2, '0')

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <img src="/logo.png" alt="VitaShield" style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover' }} />
          <span className="logo-text">VitaShield</span>
        </div>
        <nav className="nav">
          {[
            { id: 'dashboard', icon: '📊', label: 'Tong quan' },
            { id: 'children', icon: '👨‍👩‍👧‍👦', label: 'Quan ly con' },
            { id: 'filter', icon: '🔒', label: 'Loc noi dung' },
            { id: 'screentime', icon: '⏱️', label: 'Thoi gian man hinh' },
            { id: 'alerts', icon: '🔔', label: 'Canh bao', badge: blockedCount },
            { id: 'reports', icon: '📈', label: 'Bao cao' },
            { id: 'pairing', icon: '🔗', label: 'Ghep thiet bi' },
            { id: 'settings', icon: '⚙️', label: 'Cai dat' },
          ].map(item => (
            <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge > 0 && <span className="badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-children">
          <p className="sidebar-label">Thiet bi con</p>
          {children.length === 0 && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', padding: '8px' }}>Chua co thiet bi</p>}
          {children.map(c => (
            <button key={c.id} className={`child-pill ${selectedChild?.id === c.id ? 'active' : ''}`} onClick={() => setSelectedChild(c)}>
              <span>👦</span>
              <span>{c.childName || 'Con'}</span>
              <span className={`dot ${c.online ? 'online' : 'offline'}`}></span>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <h1 className="page-title">
              {activeTab === 'dashboard' && '📊 Tong quan'}
              {activeTab === 'children' && '👨‍👩‍👧‍👦 Quan ly con'}
              {activeTab === 'filter' && '🔒 Loc noi dung'}
              {activeTab === 'screentime' && '⏱️ Thoi gian man hinh'}
              {activeTab === 'alerts' && '🔔 Canh bao'}
              {activeTab === 'reports' && '📈 Bao cao'}
              {activeTab === 'pairing' && '🔗 Ghep thiet bi'}
              {activeTab === 'settings' && '⚙️ Cai dat'}
            </h1>
            <p className="page-sub">{child ? `Dang xem: ${child.childName} 💜` : 'Chua chon thiet bi'}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: 600 }}>{user.email}</span>
            <button className="ai-coach-btn" onClick={() => setAiCoachOpen(true)}>🤖 AI Coach</button>
            <button onClick={() => signOut(auth)} style={{ background: '#fdf4ff', color: '#c084fc', border: '1.5px solid #f3e8ff', borderRadius: '12px', padding: '10px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 700, fontFamily: 'Nunito, sans-serif' }}>
              Dang xuat
            </button>
          </div>
        </header>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="content">
            {!child ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                <img src="/logo.png" alt="" style={{ width: 80, borderRadius: 20, marginBottom: 16 }} />
                <h3 style={{ color: '#7e22ce', marginBottom: '12px', fontFamily: 'Nunito, sans-serif' }}>Chua co thiet bi con nao 💜</h3>
                <p style={{ color: '#c084fc', marginBottom: '24px', fontWeight: 600 }}>Ghep thiet bi cua con de bat dau theo doi</p>
                <button className="add-child-btn" onClick={() => setActiveTab('pairing')}>+ Ghep thiet bi ngay</button>
              </div>
            ) : (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon blue">⏱️</div>
                    <div>
                      <div className="stat-value">{child.screenTime || 0}p</div>
                      <div className="stat-label">Man hinh hom nay</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon red">🚫</div>
                    <div>
                      <div className="stat-value">{blockedCount}</div>
                      <div className="stat-label">Trang bi chan</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon green">✅</div>
                    <div>
                      <div className="stat-value">{safeCount}</div>
                      <div className="stat-label">Trang an toan</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon purple">📱</div>
                    <div>
                      <div className="stat-value">{child.online ? '🟢' : '⚫'}</div>
                      <div className="stat-label">{child.online ? 'Dang online' : 'Offline'}</div>
                    </div>
                  </div>
                </div>

                {/* BAO CAO TU DONG */}
                <div className="card" style={{ background: 'linear-gradient(135deg, #fdf4ff, #f3e8ff)', border: '1.5px solid #e9d5ff' }}>
                  <h3 className="card-title">📧 Bao cao hoat dong</h3>
                  <p style={{ color: '#7e22ce', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                    Gui bao cao hoat dong cua con ve email cua ban ngay bay gio.
                  </p>
                  <div className="report-summary" style={{ marginBottom: 16 }}>
                    <div className="summary-item"><span>Trang bi chan</span><strong style={{ color: '#be185d' }}>{blockedCount}</strong></div>
                    <div className="summary-item"><span>Trang an toan</span><strong style={{ color: '#15803d' }}>{safeCount}</strong></div>
                    <div className="summary-item"><span>Thoi gian man hinh</span><strong>{child?.screenTime || 0} phut</strong></div>
                  </div>
                  {reportSent && (
                    <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', color: '#15803d', fontSize: 13, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
                      ✅ Da gui bao cao thanh cong!
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => sendReport('day')}
                      disabled={reportLoading}
                      style={{ flex: 1, background: 'linear-gradient(135deg, #ec4899, #a855f7)', color: 'white', border: 'none', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', opacity: reportLoading ? 0.7 : 1 }}
                    >
                      {reportLoading ? '⏳...' : '📊 Bao cao ngay'}
                    </button>
                    <button
                      onClick={() => sendReport('week')}
                      disabled={reportLoading}
                      style={{ flex: 1, background: 'white', color: '#a855f7', border: '1.5px solid #e9d5ff', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', opacity: reportLoading ? 0.7 : 1 }}
                    >
                      {reportLoading ? '⏳...' : '📅 Bao cao tuan'}
                    </button>
                  </div>
                </div>

                <div className="card">
                  <h3 className="card-title">🔔 Hoat dong gan day</h3>
                  {alerts.length === 0 && <p style={{ color: '#c084fc', fontWeight: 600 }}>Chua co du lieu — con chua dung Extension</p>}
                  <div className="alert-list">
                    {alerts.slice(0, 10).map(a => (
                      <div key={a.id} className={`alert-row ${a.blocked ? 'danger' : 'info'}`}>
                        <span className="alert-icon">{a.blocked ? '🚫' : '✅'}</span>
                        <div className="alert-content">
                          <p className="alert-title">{a.url}</p>
                          <p className="alert-time">{new Date(a.time).toLocaleString('vi-VN')}</p>
                        </div>
                        <span className={`tag ${a.blocked ? 'danger' : 'on'}`}>{a.blocked ? 'Bi chan' : 'An toan'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* PAIRING */}
        {activeTab === 'pairing' && (
          <div className="content">
            <div className="card" style={{ textAlign: 'center' }}>
              <h3 className="card-title" style={{ justifyContent: 'center' }}>🔗 Ghep thiet bi con</h3>
              <p style={{ color: '#c084fc', marginBottom: '24px', fontWeight: 600 }}>Moi ma chi dung 1 lan va het han sau 10 phut 💜</p>
              {pairingCode ? (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ background: 'linear-gradient(135deg, #fdf4ff, #f3e8ff)', borderRadius: 20, padding: '28px 32px', display: 'inline-block', border: '2px solid #e9d5ff', marginBottom: 12 }}>
                    <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: 14, color: '#7e22ce', fontFamily: 'Nunito, monospace' }}>
                      {pairingCode}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Nunito, sans-serif', color: pairingCountdown < 60 ? '#ef4444' : '#a855f7', background: pairingCountdown < 60 ? '#fff0f6' : '#fdf4ff', border: `1.5px solid ${pairingCountdown < 60 ? '#fbcfe8' : '#f3e8ff'}`, borderRadius: 12, padding: '8px 20px', display: 'inline-block' }}>
                    ⏱️ Het han sau {countdownMin}:{countdownSec}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 24, padding: '40px 32px', background: '#fdf4ff', borderRadius: 20, border: '2px dashed #e9d5ff' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
                  <p style={{ color: '#c084fc', fontWeight: 700, fontFamily: 'Nunito, sans-serif' }}>Nhan "Tao ma moi" de bat dau ghep cap 💜</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
                <button onClick={regenerateCode} disabled={codeLoading} style={{ background: 'linear-gradient(135deg, #ec4899, #a855f7)', color: 'white', border: 'none', borderRadius: 14, padding: '12px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', opacity: codeLoading ? 0.7 : 1 }}>
                  {codeLoading ? '⏳ Dang tao...' : '✨ Tao ma moi'}
                </button>
                {pairingCode && (
                  <button onClick={() => setShowQR(!showQR)} style={{ background: '#fdf4ff', color: '#a855f7', border: '2px solid #e9d5ff', borderRadius: 14, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>
                    {showQR ? '🙈 An QR' : '📱 Hien QR Code'}
                  </button>
                )}
              </div>
              {showQR && pairingCode && (
                <div style={{ marginBottom: 24 }}>
                  <QRCode value={`vitashield://pair/${pairingCode}`} />
                  <p style={{ color: '#c084fc', fontSize: 12, marginTop: 8, fontWeight: 600 }}>Quet bang camera dien thoai</p>
                </div>
              )}
              <div style={{ background: '#fdf4ff', borderRadius: 16, padding: 20, textAlign: 'left', border: '1.5px solid #f3e8ff' }}>
                <p style={{ color: '#7e22ce', fontWeight: 800, marginBottom: 12, fontFamily: 'Nunito, sans-serif' }}>💜 Huong dan:</p>
                {['Cai VitaShield Extension tren Chrome cua con', 'Nhan "Tao ma moi" o tren de tao ma 6 so', 'Bam vao icon Extension → nhap ten + ma 6 so', 'Thiet bi cua con se xuat hien trong danh sach'].map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #ec4899, #a855f7)', color: 'white', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                    <p style={{ color: '#3b1f5e', fontSize: 13, fontWeight: 600, lineHeight: 1.6 }}>{step}</p>
                  </div>
                ))}
              </div>
              {children.length > 0 && (
                <div style={{ marginTop: 24, textAlign: 'left' }}>
                  <h4 style={{ color: '#7e22ce', marginBottom: 12, fontFamily: 'Nunito, sans-serif', fontWeight: 800 }}>Thiet bi da ghep:</h4>
                  {children.map(c => (
                    <div key={c.id} className="alert-row info" style={{ marginBottom: 8 }}>
                      <span>👦</span>
                      <div>
                        <p style={{ color: '#3b1f5e', fontWeight: 700 }}>{c.childName}</p>
                        <p style={{ color: '#c084fc', fontSize: 12, fontWeight: 600 }}>Ghep luc: {new Date(c.pairedAt).toLocaleString('vi-VN')}</p>
                      </div>
                      <span className={`tag ${c.online ? 'on' : 'off'}`}>{c.online ? '🟢 Online' : '⚫ Offline'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ALERTS */}
        {activeTab === 'alerts' && (
          <div className="content">
            <div className="card">
              <h3 className="card-title">🚫 Trang bi chan ({blockedCount})</h3>
              {alerts.filter(a => a.blocked).length === 0 && <p style={{ color: '#c084fc', fontWeight: 600, marginBottom: 16 }}>Khong co trang nao bi chan.</p>}
              <div className="alert-list">
                {alerts.filter(a => a.blocked).map(a => (
                  <div key={a.id} className="alert-row danger">
                    <span className="alert-icon">🚫</span>
                    <div className="alert-content">
                      <p className="alert-title">{a.url}</p>
                      <p className="alert-desc">Bi chan boi VitaShield — {a.reason || 'noi dung khong phu hop'}</p>
                      <p className="alert-time">{new Date(a.time).toLocaleString('vi-VN')}</p>
                    </div>
                    <span className="tag danger">Nguy hiem</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <h3 className="card-title">✅ Trang an toan ({safeCount})</h3>
              {alerts.filter(a => !a.blocked).length === 0 && <p style={{ color: '#c084fc', fontWeight: 600 }}>Chua co du lieu.</p>}
              <div className="alert-list">
                {alerts.filter(a => !a.blocked).map(a => (
                  <div key={a.id} className="alert-row info">
                    <span className="alert-icon">✅</span>
                    <div className="alert-content">
                      <p className="alert-title">{a.url}</p>
                      <p className="alert-time">{new Date(a.time).toLocaleString('vi-VN')}</p>
                    </div>
                    <span className="tag on">An toan</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FILTER */}
        {activeTab === 'filter' && (
          <div className="content">
            <div className="card">
              <div className="toggle-row">
                <div>
                  <h3 className="card-title">🔒 Bo loc noi dung AI</h3>
                  <p className="card-sub">Chan tu dong noi dung khong phu hop</p>
                </div>
                <button className={`toggle ${filterEnabled ? 'on' : 'off'}`} onClick={() => toggleFilter(!filterEnabled)}>
                  {filterEnabled ? 'BAT' : 'TAT'}
                </button>
              </div>
              <div className="filter-cats">
                {[
                  { icon: '🔞', label: 'Noi dung 18+' },
                  { icon: '🔫', label: 'Bao luc' },
                  { icon: '🎰', label: 'Co bac' },
                  { icon: '💊', label: 'Ma tuy' },
                  { icon: '😰', label: 'Tu lam hai' },
                  { icon: '💬', label: 'Ngon ngu doc hai' },
                ].map((cat, i) => (
                  <div key={i} className="filter-cat">
                    <span>{cat.icon} {cat.label}</span>
                    <span className="tag on">Dang chan</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="card-title">🌐 Website chan thu cong</h3>
              <div className="blocked-list">
                {blockedUrls.length === 0 && <p style={{ color: '#c084fc', fontSize: 14, fontWeight: 600 }}>Chua co website nao duoc chan thu cong</p>}
                {blockedUrls.map((url, i) => (
                  <div key={i} className="blocked-url">
                    <span>🚫 {url}</span>
                    <button className="remove-btn" onClick={() => removeBlockedUrl(url)}>Xoa</button>
                  </div>
                ))}
              </div>
              <div className="add-url">
                <input className="url-input" placeholder="vd: tiktok.com, facebook.com..." value={newBlockedUrl} onChange={e => setNewBlockedUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBlockedUrl()} />
                <button className="add-btn" onClick={addBlockedUrl}>+ Them</button>
              </div>
            </div>
          </div>
        )}

        {/* CHILDREN */}
        {activeTab === 'children' && (
          <div className="content">
            {children.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                <p style={{ fontSize: 48, marginBottom: 12 }}>👨‍👩‍👧‍👦</p>
                <h3 style={{ color: '#7e22ce', marginBottom: 12 }}>Chua co thiet bi con</h3>
                <button className="add-child-btn" onClick={() => setActiveTab('pairing')}>+ Ghep thiet bi</button>
              </div>
            ) : (
              children.map(c => (
                <div key={c.id} className="card child-card">
                  <div className="child-header">
                    <div className="child-avatar">👦</div>
                    <div style={{ flex: 1 }}>
                      <h3 className="child-name">{c.childName}</h3>
                      <p className="card-sub">Ghep luc: {new Date(c.pairedAt).toLocaleString('vi-VN')}</p>
                      <span className={`tag ${c.online ? 'on' : 'off'}`}>{c.online ? '🟢 Dang online' : '⚫ Offline'}</span>
                    </div>
                    <button onClick={() => removeDevice(c.id)} style={{ background: '#fce7f3', color: '#be185d', border: '1.5px solid #fbcfe8', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                      🗑️ Xoa
                    </button>
                  </div>
                </div>
              ))
            )}
            <button className="add-child-btn" onClick={() => setActiveTab('pairing')}>+ Ghep thiet bi moi</button>
          </div>
        )}

        {/* SCREEN TIME */}
        {activeTab === 'screentime' && (
          <div className="content">
            <div className="card">
              <h3 className="card-title">⏱️ Thoi gian man hinh hom nay</h3>
              {child ? (
                <>
                  <div className="screen-time-display">
                    <div className="screen-time-nums">
                      <span className="big-num">{child.screenTime || 0}</span>
                      <span className="limit"> / {screenTimeLimit} phut</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${Math.min(((child.screenTime || 0) / screenTimeLimit) * 100, 100)}%`, background: (child.screenTime || 0) > screenTimeLimit ? '#ef4444' : undefined }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <p style={{ color: '#c084fc', marginBottom: 8, fontWeight: 600 }}>Gioi han moi ngay (phut):</p>
                    <input type="number" value={screenTimeLimit} min={30} max={480} onChange={e => updateScreenTimeLimit(Number(e.target.value))}
                      style={{ background: '#fdf4ff', color: '#3b1f5e', border: '2px solid #f3e8ff', borderRadius: 10, padding: '8px 14px', width: 100, fontSize: 16, fontWeight: 700 }} />
                  </div>
                </>
              ) : <p style={{ color: '#c084fc', fontWeight: 600 }}>Chua co thiet bi</p>}
              <div className="time-settings" style={{ marginTop: 20 }}>
                <div className="time-row">
                  <div>
                    <span style={{ fontWeight: 700 }}>Che do Bedtime 🌙</span>
                    <p className="card-sub">Khoa thiet bi luc 21:30 - 06:00</p>
                  </div>
                  <button className={`toggle ${bedtimeEnabled ? 'on' : 'off'}`} onClick={() => toggleBedtime(!bedtimeEnabled)}>
                    {bedtimeEnabled ? 'BAT' : 'TAT'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS */}
        {activeTab === 'reports' && (
          <div className="content">
            <div className="card">
              <h3 className="card-title">📈 Bao cao hoat dong</h3>
              <div className="report-summary">
                <div className="summary-item"><span>Tong URL da phan tich</span><strong>{alerts.length}</strong></div>
                <div className="summary-item"><span>Trang bi chan</span><strong style={{ color: '#be185d' }}>{blockedCount}</strong></div>
                <div className="summary-item"><span>Trang an toan</span><strong style={{ color: '#15803d' }}>{safeCount}</strong></div>
                <div className="summary-item"><span>Thoi gian man hinh</span><strong>{child?.screenTime || 0} phut</strong></div>
                <div className="summary-item"><span>Website chan thu cong</span><strong>{blockedUrls.length}</strong></div>
              </div>
            </div>
            <div className="card" style={{ background: 'linear-gradient(135deg, #fdf4ff, #f3e8ff)', border: '1.5px solid #e9d5ff' }}>
              <h3 className="card-title">📧 Gui bao cao qua email</h3>
              <p style={{ color: '#7e22ce', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Gui bao cao hoat dong cua con ve {user.email}</p>
              {reportSent && (
                <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', color: '#15803d', fontSize: 13, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
                  ✅ Da gui bao cao thanh cong!
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => sendReport('day')} disabled={reportLoading} style={{ flex: 1, background: 'linear-gradient(135deg, #ec4899, #a855f7)', color: 'white', border: 'none', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: reportLoading ? 0.7 : 1 }}>
                  {reportLoading ? '⏳...' : '📊 Bao cao ngay'}
                </button>
                <button onClick={() => sendReport('week')} disabled={reportLoading} style={{ flex: 1, background: 'white', color: '#a855f7', border: '1.5px solid #e9d5ff', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: reportLoading ? 0.7 : 1 }}>
                  {reportLoading ? '⏳...' : '📅 Bao cao tuan'}
                </button>
              </div>
            </div>
            <div className="card">
              <h3 className="card-title">🚫 Top website bi chan nhieu nhat</h3>
              {alerts.filter(a => a.blocked).length === 0
                ? <p style={{ color: '#c084fc', fontWeight: 600 }}>Chua co du lieu</p>
                : Object.entries(alerts.filter(a => a.blocked).reduce((acc, a) => {
                    const host = a.url?.replace(/https?:\/\//, '').split('/')[0] || a.url
                    acc[host] = (acc[host] || 0) + 1
                    return acc
                  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([host, count], i) => (
                    <div key={i} className="blocked-url">
                      <span>🚫 {host}</span>
                      <span className="tag danger">{count} lan</span>
                    </div>
                  ))
              }
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <div className="content">
            <div className="card">
              <h3 className="card-title">⚙️ Cai dat tai khoan</h3>
              <div className="report-summary">
                <div className="summary-item"><span>Email</span><strong>{user.email}</strong></div>
                <div className="summary-item"><span>So thiet bi con</span><strong>{children.length}</strong></div>
              </div>
            </div>
            <div className="card" style={{ borderColor: '#fbcfe8' }}>
              <h3 className="card-title" style={{ color: '#be185d' }}>⚠️ Vung nguy hiem</h3>
              <p style={{ color: '#c084fc', marginBottom: 16, fontWeight: 600 }}>Xoa tai khoan se xoa toan bo du lieu va khong the khoi phuc.</p>
              {!showDeleteConfirm ? (
                <button onClick={() => setShowDeleteConfirm(true)} style={{ background: '#fce7f3', color: '#be185d', border: '1.5px solid #fbcfe8', borderRadius: 12, padding: '12px 24px', cursor: 'pointer', fontWeight: 700 }}>
                  🗑️ Xoa tai khoan
                </button>
              ) : (
                <div style={{ background: '#fff0f6', borderRadius: 14, padding: 20, border: '1.5px solid #fbcfe8' }}>
                  <p style={{ color: '#be185d', fontWeight: 700, marginBottom: 16 }}>Ban chac chan muon xoa tai khoan?</p>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={handleDeleteAccount} style={{ background: '#be185d', color: 'white', border: 'none', borderRadius: 12, padding: '12px 24px', cursor: 'pointer', fontWeight: 700 }}>
                      Xac nhan xoa
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)} style={{ background: '#fdf4ff', color: '#c084fc', border: '1.5px solid #f3e8ff', borderRadius: 12, padding: '12px 24px', cursor: 'pointer', fontWeight: 700 }}>
                      Huy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* AI Coach Modal */}
      {aiCoachOpen && (
        <div className="modal-overlay" onClick={() => setAiCoachOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🤖 VitaShield AI Coach</h2>
              <button className="close-btn" onClick={() => setAiCoachOpen(false)}>✕</button>
            </div>
            <p className="modal-sub">Hoi AI ve cach nuoi day con an toan tren mang 💜</p>
            <div className="coach-examples">
              {[
                'Con toi xem TikTok qua nhieu, lam sao noi chuyen voi con?',
                'Lam sao giai thich cho con 10 tuoi ve nguy hiem online?',
                'Con co dau hieu bi bat nat online, toi nen lam gi?',
              ].map((q, i) => (
                <button key={i} className="example-q" onClick={() => setAiCoachMsg(q)}>{q}</button>
              ))}
            </div>
            <textarea className="coach-input" placeholder="Nhap cau hoi..." value={aiCoachMsg} onChange={e => setAiCoachMsg(e.target.value)} rows={3} />
            <button className="coach-send" onClick={askAiCoach} disabled={aiLoading}>
              {aiLoading ? '⏳ Dang phan tich...' : '💬 Hoi AI Coach'}
            </button>
            {aiResponse && (
              <div className="coach-response">
                <p className="response-label">💡 Goi y tu VitaShield AI:</p>
                <p>{aiResponse}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}