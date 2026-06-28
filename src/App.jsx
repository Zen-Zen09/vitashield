import { useState, useEffect } from 'react'
import './App.css'
import Login from './Login'
import { auth, db } from './firebase'
import { onAuthStateChanged, signOut, deleteUser } from 'firebase/auth'
import { doc, setDoc, getDoc, collection, onSnapshot, deleteDoc, query, where, getDocs, addDoc } from 'firebase/firestore'

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function QRCode({ value }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(value)}`
  return <img src={url} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 12 }} />
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedChild, setSelectedChild] = useState(null)
  const [children, setChildren] = useState([])
  const [alerts, setAlerts] = useState([])
  const [pairingCode, setPairingCode] = useState('')
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
        setPairingCode(data.pairingCode || '')
        setBlockedUrls(data.blockedUrls || [])
        setBedtimeEnabled(data.bedtimeEnabled ?? true)
        setFilterEnabled(data.filterEnabled ?? true)
        setScreenTimeLimit(data.screenTimeLimit || 120)
      } else {
        const code = generateCode()
        setDoc(parentRef, { pairingCode: code, email: user.email, blockedUrls: [], bedtimeEnabled: true, filterEnabled: true, screenTimeLimit: 120 })
        setPairingCode(code)
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
        .sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 50)
      setAlerts(list)
    })
    return unsub
  }, [user, selectedChild])

  async function saveParentSettings(updates) {
    await setDoc(doc(db, 'parents', user.uid), updates, { merge: true })
  }

  async function regenerateCode() {
    const code = generateCode()
    await saveParentSettings({ pairingCode: code })
    setPairingCode(code)
  }

  async function addBlockedUrl() {
    if (!newBlockedUrl.trim()) return
    const updated = [...blockedUrls, newBlockedUrl.trim().toLowerCase()]
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
      await deleteUser(user)
    } catch (e) {
      alert('Lỗi: ' + e.message + '\nVui lòng đăng xuất và đăng nhập lại trước khi xóa.')
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
      setAiResponse(data.result || 'Xin lỗi, không thể kết nối AI.')
    } catch {
      setAiResponse('Không thể kết nối AI. Vui lòng thử lại.')
    }
    setAiLoading(false)
  }

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f7ff, #e8f5ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a4d8c', fontSize: '24px', fontWeight: '700' }}>
      <img src="/logo.png" alt="VitaShield" style={{ width: 60, marginRight: 16, borderRadius: 12 }} />
      Đang tải VitaShield...
    </div>
  )

  if (!user) return <Login onLogin={() => {}} />

  const child = selectedChild
  const blockedCount = alerts.filter(a => a.blocked).length
  const safeCount = alerts.filter(a => !a.blocked).length

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <img src="/logo.png" alt="VitaShield" style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover' }} />
          <span className="logo-text">VitaShield</span>
        </div>
        <nav className="nav">
          {[
            { id: 'dashboard', icon: '📊', label: 'Tổng quan' },
            { id: 'children', icon: '👨‍👩‍👧‍👦', label: 'Quản lý con' },
            { id: 'filter', icon: '🔒', label: 'Lọc nội dung' },
            { id: 'screentime', icon: '⏱️', label: 'Thời gian màn hình' },
            { id: 'alerts', icon: '🔔', label: 'Cảnh báo', badge: blockedCount },
            { id: 'reports', icon: '📈', label: 'Báo cáo' },
            { id: 'pairing', icon: '🔗', label: 'Ghép thiết bị' },
            { id: 'settings', icon: '⚙️', label: 'Cài đặt' },
          ].map(item => (
            <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge > 0 && <span className="badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-children">
          <p className="sidebar-label">Thiết bị con</p>
          {children.length === 0 && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', padding: '8px' }}>Chưa có thiết bị</p>}
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
              {activeTab === 'dashboard' && 'Tổng quan'}
              {activeTab === 'children' && 'Quản lý con'}
              {activeTab === 'filter' && 'Lọc nội dung'}
              {activeTab === 'screentime' && 'Thời gian màn hình'}
              {activeTab === 'alerts' && 'Cảnh báo'}
              {activeTab === 'reports' && 'Báo cáo'}
              {activeTab === 'pairing' && 'Ghép thiết bị'}
              {activeTab === 'settings' && 'Cài đặt'}
            </h1>
            <p className="page-sub">{child ? `Đang xem: ${child.childName}` : 'Chưa chọn thiết bị'}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#7a9cbf' }}>{user.email}</span>
            <button className="ai-coach-btn" onClick={() => setAiCoachOpen(true)}>🤖 AI Coach</button>
            <button onClick={() => signOut(auth)} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', cursor: 'pointer' }}>
              Đăng xuất
            </button>
          </div>
        </header>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="content">
            {!child ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                <img src="/logo.png" alt="" style={{ width: 80, borderRadius: 16, marginBottom: 16 }} />
                <h3 style={{ color: '#0a4d8c', marginBottom: '12px' }}>Chưa có thiết bị con nào</h3>
                <p style={{ color: '#7a9cbf', marginBottom: '24px' }}>Ghép thiết bị của con để bắt đầu theo dõi</p>
                <button className="add-child-btn" onClick={() => setActiveTab('pairing')}>+ Ghép thiết bị ngay</button>
              </div>
            ) : (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon blue">⏱️</div>
                    <div>
                      <div className="stat-value">{child.screenTime || 0}p</div>
                      <div className="stat-label">Màn hình hôm nay</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon red">🚫</div>
                    <div>
                      <div className="stat-value">{blockedCount}</div>
                      <div className="stat-label">Trang bị chặn</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon green">✅</div>
                    <div>
                      <div className="stat-value">{safeCount}</div>
                      <div className="stat-label">Trang an toàn</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon purple">📱</div>
                    <div>
                      <div className="stat-value">{child.online ? '🟢' : '⚫'}</div>
                      <div className="stat-label">{child.online ? 'Đang online' : 'Offline'}</div>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <h3 className="card-title">🔔 Hoạt động gần đây</h3>
                  {alerts.length === 0 && <p style={{ color: '#7a9cbf' }}>Chưa có dữ liệu — con chưa dùng Extension</p>}
                  <div className="alert-list">
                    {alerts.slice(0, 10).map(a => (
                      <div key={a.id} className={`alert-row ${a.blocked ? 'danger' : 'info'}`}>
                        <span className="alert-icon">{a.blocked ? '🚫' : '✅'}</span>
                        <div className="alert-content">
                          <p className="alert-title">{a.url}</p>
                          <p className="alert-time">{new Date(a.time).toLocaleString('vi-VN')}</p>
                        </div>
                        <span className={`tag ${a.blocked ? 'danger' : 'on'}`}>{a.blocked ? 'Bị chặn' : 'An toàn'}</span>
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
              <h3 className="card-title">🔗 Ghép thiết bị con</h3>
              <p style={{ color: '#7a9cbf', marginBottom: '24px' }}>Cho con nhập mã này vào VitaShield Extension trên Chrome</p>
              <div style={{ background: 'linear-gradient(135deg, #eff8ff, #e8f5ee)', borderRadius: '16px', padding: '32px', display: 'inline-block', marginBottom: '24px', border: '2px solid #bfdbfe' }}>
                <div style={{ fontSize: '48px', fontWeight: '800', letterSpacing: '12px', color: '#0a4d8c', fontFamily: 'monospace' }}>
                  {pairingCode}
                </div>
              </div>
              <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="add-child-btn" onClick={() => setShowQR(!showQR)} style={{ width: 'auto', padding: '10px 20px' }}>
                  {showQR ? 'Ẩn QR' : '📱 Hiện QR Code'}
                </button>
                <button className="add-child-btn" onClick={regenerateCode} style={{ width: 'auto', padding: '10px 20px' }}>🔄 Tạo mã mới</button>
              </div>
              {showQR && (
                <div style={{ marginBottom: '24px' }}>
                  <QRCode value={`vitashield://pair/${pairingCode}`} />
                  <p style={{ color: '#7a9cbf', fontSize: '12px', marginTop: '8px' }}>Quét bằng camera điện thoại</p>
                </div>
              )}
              <div style={{ background: '#f8faff', borderRadius: '12px', padding: '20px', textAlign: 'left', border: '1px solid #e2edf7' }}>
                <p style={{ color: '#0a4d8c', fontWeight: '600', marginBottom: '12px' }}>Hướng dẫn:</p>
                <p style={{ color: '#7a9cbf', fontSize: '14px', lineHeight: '1.8' }}>
                  1. Cài VitaShield Extension trên Chrome của con<br />
                  2. Bấm vào icon Extension → nhập mã 6 số ở trên<br />
                  3. Thiết bị của con sẽ xuất hiện trong danh sách<br />
                  4. Bạn có thể theo dõi và kiểm soát từ đây
                </p>
              </div>
              {children.length > 0 && (
                <div style={{ marginTop: '24px', textAlign: 'left' }}>
                  <h4 style={{ color: '#0a4d8c', marginBottom: '12px' }}>Thiết bị đã ghép:</h4>
                  {children.map(c => (
                    <div key={c.id} className="alert-row info" style={{ marginBottom: '8px' }}>
                      <span>👦</span>
                      <div>
                        <p style={{ color: '#1e3a5f', fontWeight: '600' }}>{c.childName}</p>
                        <p style={{ color: '#7a9cbf', fontSize: '12px' }}>Ghép lúc: {new Date(c.pairedAt).toLocaleString('vi-VN')}</p>
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
              <h3 className="card-title">🔔 Tất cả cảnh báo</h3>
              {alerts.length === 0 && <p style={{ color: '#7a9cbf' }}>Chưa có dữ liệu. Hãy ghép thiết bị con trước.</p>}
              <div className="alert-list">
                {alerts.map(a => (
                  <div key={a.id} className={`alert-row ${a.blocked ? 'danger' : 'info'}`}>
                    <span className="alert-icon">{a.blocked ? '🚫' : '✅'}</span>
                    <div className="alert-content">
                      <p className="alert-title">{a.url}</p>
                      <p className="alert-desc">{a.blocked ? 'Bị chặn bởi VitaShield' : 'Truy cập bình thường'}</p>
                      <p className="alert-time">{new Date(a.time).toLocaleString('vi-VN')}</p>
                    </div>
                    <span className={`tag ${a.blocked ? 'danger' : 'on'}`}>{a.blocked ? 'Nguy hiểm' : 'An toàn'}</span>
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
                  <h3 className="card-title">🔒 Bộ lọc nội dung AI</h3>
                  <p className="card-sub">Chặn tự động nội dung không phù hợp</p>
                </div>
                <button className={`toggle ${filterEnabled ? 'on' : 'off'}`} onClick={() => toggleFilter(!filterEnabled)}>
                  {filterEnabled ? 'BẬT' : 'TẮT'}
                </button>
              </div>
              <div className="filter-cats">
                {[
                  { icon: '🔞', label: 'Nội dung 18+' },
                  { icon: '🔫', label: 'Bạo lực' },
                  { icon: '🎰', label: 'Cờ bạc' },
                  { icon: '💊', label: 'Ma túy' },
                  { icon: '😰', label: 'Tự làm hại' },
                  { icon: '💬', label: 'Ngôn ngữ độc hại' },
                ].map((cat, i) => (
                  <div key={i} className="filter-cat">
                    <span>{cat.icon} {cat.label}</span>
                    <span className="tag on">Đang chặn</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="card-title">🌐 Website chặn thủ công</h3>
              <div className="blocked-list">
                {blockedUrls.length === 0 && <p style={{ color: '#7a9cbf', fontSize: '14px' }}>Chưa có website nào được chặn thủ công</p>}
                {blockedUrls.map((url, i) => (
                  <div key={i} className="blocked-url">
                    <span>🚫 {url}</span>
                    <button className="remove-btn" onClick={() => removeBlockedUrl(url)}>Xóa</button>
                  </div>
                ))}
              </div>
              <div className="add-url">
                <input className="url-input" placeholder="vd: tiktok.com, facebook.com..." value={newBlockedUrl} onChange={e => setNewBlockedUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBlockedUrl()} />
                <button className="add-btn" onClick={addBlockedUrl}>+ Thêm</button>
              </div>
            </div>
          </div>
        )}

        {/* CHILDREN */}
        {activeTab === 'children' && (
          <div className="content">
            {children.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                <p style={{ fontSize: '48px' }}>👨‍👩‍👧‍👦</p>
                <h3 style={{ color: '#0a4d8c', marginBottom: '12px' }}>Chưa có thiết bị con</h3>
                <button className="add-child-btn" onClick={() => setActiveTab('pairing')}>+ Ghép thiết bị</button>
              </div>
            ) : (
              children.map(c => (
                <div key={c.id} className="card child-card">
                  <div className="child-header">
                    <div className="child-avatar">👦</div>
                    <div style={{ flex: 1 }}>
                      <h3 className="child-name">{c.childName}</h3>
                      <p className="card-sub">Ghép lúc: {new Date(c.pairedAt).toLocaleString('vi-VN')}</p>
                      <span className={`tag ${c.online ? 'on' : 'off'}`}>{c.online ? '🟢 Đang online' : '⚫ Offline'}</span>
                    </div>
                    <button onClick={() => removeDevice(c.id)} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px' }}>
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
            <button className="add-child-btn" onClick={() => setActiveTab('pairing')}>+ Ghép thiết bị mới</button>
          </div>
        )}

        {/* SCREEN TIME */}
        {activeTab === 'screentime' && (
          <div className="content">
            <div className="card">
              <h3 className="card-title">⏱️ Thời gian màn hình hôm nay</h3>
              {child ? (
                <>
                  <div className="screen-time-display">
                    <div className="screen-time-nums">
                      <span className="big-num">{child.screenTime || 0}</span>
                      <span className="limit"> / {screenTimeLimit} phút</span>
                    </div>
                    <div style={{ background: '#e2edf7', borderRadius: '8px', height: '12px', marginTop: '12px' }}>
                      <div style={{
                        background: (child.screenTime || 0) > screenTimeLimit ? '#ef4444' : 'linear-gradient(90deg, #0a4d8c, #0a9e78)',
                        width: `${Math.min(((child.screenTime || 0) / screenTimeLimit) * 100, 100)}%`,
                        height: '12px', borderRadius: '8px', transition: 'width 0.5s'
                      }} />
                    </div>
                  </div>
                  <div style={{ marginTop: '20px' }}>
                    <p style={{ color: '#7a9cbf', marginBottom: '8px' }}>Giới hạn mỗi ngày (phút):</p>
                    <input type="number" value={screenTimeLimit} min={30} max={480} onChange={e => updateScreenTimeLimit(Number(e.target.value))}
                      style={{ background: '#f8faff', color: '#1e3a5f', border: '1px solid #e2edf7', borderRadius: '8px', padding: '8px 14px', width: '100px', fontSize: '16px' }} />
                  </div>
                </>
              ) : <p style={{ color: '#7a9cbf' }}>Chưa có thiết bị</p>}
              <div className="time-settings" style={{ marginTop: '20px' }}>
                <div className="time-row">
                  <div>
                    <span>Chế độ Bedtime 🌙</span>
                    <p className="card-sub">Khóa thiết bị lúc 21:30 – 06:00</p>
                  </div>
                  <button className={`toggle ${bedtimeEnabled ? 'on' : 'off'}`} onClick={() => toggleBedtime(!bedtimeEnabled)}>
                    {bedtimeEnabled ? 'BẬT' : 'TẮT'}
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
              <h3 className="card-title">📈 Báo cáo hoạt động</h3>
              <div className="report-summary">
                <div className="summary-item"><span>Tổng URL đã phân tích</span><strong>{alerts.length}</strong></div>
                <div className="summary-item"><span>Trang bị chặn</span><strong style={{ color: '#dc2626' }}>{blockedCount}</strong></div>
                <div className="summary-item"><span>Trang an toàn</span><strong style={{ color: '#059669' }}>{safeCount}</strong></div>
                <div className="summary-item"><span>Thời gian màn hình</span><strong>{child?.screenTime || 0} phút</strong></div>
                <div className="summary-item"><span>Website chặn thủ công</span><strong>{blockedUrls.length}</strong></div>
              </div>
            </div>
            <div className="card">
              <h3 className="card-title">🚫 Top website bị chặn nhiều nhất</h3>
              {alerts.filter(a => a.blocked).length === 0
                ? <p style={{ color: '#7a9cbf' }}>Chưa có dữ liệu</p>
                : Object.entries(alerts.filter(a => a.blocked).reduce((acc, a) => {
                    const host = a.url?.replace(/https?:\/\//, '').split('/')[0] || a.url
                    acc[host] = (acc[host] || 0) + 1
                    return acc
                  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([host, count], i) => (
                    <div key={i} className="blocked-url">
                      <span>🚫 {host}</span>
                      <span className="tag danger">{count} lần</span>
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
              <h3 className="card-title">⚙️ Cài đặt tài khoản</h3>
              <div className="report-summary">
                <div className="summary-item"><span>Email</span><strong>{user.email}</strong></div>
                <div className="summary-item"><span>Số thiết bị con</span><strong>{children.length}</strong></div>
                <div className="summary-item"><span>Mã ghép cặp</span><strong style={{ fontFamily: 'monospace', color: '#0a4d8c' }}>{pairingCode}</strong></div>
              </div>
            </div>
            <div className="card" style={{ borderColor: '#fecaca' }}>
              <h3 className="card-title" style={{ color: '#dc2626' }}>⚠️ Vùng nguy hiểm</h3>
              <p style={{ color: '#7a9cbf', marginBottom: '16px' }}>Xóa tài khoản sẽ xóa toàn bộ dữ liệu và không thể khôi phục.</p>
              {!showDeleteConfirm ? (
                <button onClick={() => setShowDeleteConfirm(true)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 24px', cursor: 'pointer', fontWeight: '600' }}>
                  🗑️ Xóa tài khoản
                </button>
              ) : (
                <div style={{ background: '#fff5f5', borderRadius: '12px', padding: '20px', border: '1px solid #fecaca' }}>
                  <p style={{ color: '#dc2626', fontWeight: '600', marginBottom: '16px' }}>Bạn chắc chắn muốn xóa tài khoản?</p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handleDeleteAccount} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 24px', cursor: 'pointer', fontWeight: '600' }}>
                      Xác nhận xóa
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px', padding: '12px 24px', cursor: 'pointer' }}>
                      Hủy
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
            <p className="modal-sub">Hỏi AI về cách nuôi dạy con an toàn trên mạng</p>
            <div className="coach-examples">
              {[
                'Con tôi xem TikTok quá nhiều, làm sao nói chuyện với con?',
                'Làm sao giải thích cho con 10 tuổi về nguy hiểm online?',
                'Con có dấu hiệu bị bắt nạt online, tôi nên làm gì?',
              ].map((q, i) => (
                <button key={i} className="example-q" onClick={() => setAiCoachMsg(q)}>{q}</button>
              ))}
            </div>
            <textarea className="coach-input" placeholder="Nhập câu hỏi..." value={aiCoachMsg} onChange={e => setAiCoachMsg(e.target.value)} rows={3} />
            <button className="coach-send" onClick={askAiCoach} disabled={aiLoading}>
              {aiLoading ? '⏳ Đang phân tích...' : '💬 Hỏi AI Coach'}
            </button>
            {aiResponse && (
              <div className="coach-response">
                <p className="response-label">💡 Gợi ý từ VitaShield AI:</p>
                <p>{aiResponse}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}