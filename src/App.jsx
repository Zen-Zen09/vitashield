import { useState, useEffect } from 'react'
import './App.css'
import Login from './Login'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

const MOCK_CHILDREN = [
  {
    id: 1,
    name: 'Minh Anh',
    age: 10,
    avatar: '👧',
    device: 'Samsung Galaxy A14',
    status: 'online',
    screenTimeToday: 95,
    screenTimeLimit: 120,
    appsUsed: ['YouTube Kids', 'Minecraft', 'Google Chrome'],
    alerts: 2,
    safetyScore: 87,
  },
  {
    id: 2,
    name: 'Tuấn Kiệt',
    age: 13,
    avatar: '👦',
    device: 'iPhone 13',
    status: 'offline',
    screenTimeToday: 140,
    screenTimeLimit: 120,
    appsUsed: ['TikTok', 'YouTube', 'Instagram', 'Chrome'],
    alerts: 5,
    safetyScore: 62,
  },
]

const MOCK_ALERTS = [
  { id: 1, childId: 2, type: 'danger', icon: '🚨', title: 'Nội dung không phù hợp', desc: 'Tuấn Kiệt cố truy cập trang web bị chặn: xxx-content.com', time: '14 phút trước' },
  { id: 2, childId: 2, type: 'warning', icon: '⏰', title: 'Vượt giới hạn thời gian', desc: 'Tuấn Kiệt đã dùng màn hình 20 phút quá giới hạn hôm nay', time: '1 giờ trước' },
  { id: 3, childId: 1, type: 'warning', icon: '💬', title: 'Từ khóa đáng chú ý', desc: 'Minh Anh tìm kiếm từ khóa "cách trốn học"', time: '2 giờ trước' },
  { id: 4, childId: 2, type: 'danger', icon: '🤖', title: 'Tương tác AI đáng ngờ', desc: 'Phát hiện cuộc trò chuyện bất thường với ChatGPT', time: '3 giờ trước' },
  { id: 5, childId: 1, type: 'info', icon: '✅', title: 'Sử dụng tốt', desc: 'Minh Anh đạt 50 điểm thưởng hôm nay!', time: '4 giờ trước' },
]

const MOCK_ACTIVITY = [
  { app: 'YouTube Kids', icon: '▶️', duration: 45, safe: true },
  { app: 'Minecraft', icon: '🎮', duration: 30, safe: true },
  { app: 'Google Chrome', icon: '🌐', duration: 20, safe: true },
  { app: 'TikTok', icon: '🎵', duration: 60, safe: false },
  { app: 'Instagram', icon: '📷', duration: 40, safe: false },
]

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedChild, setSelectedChild] = useState(MOCK_CHILDREN[0])
  const [bedtimeEnabled, setBedtimeEnabled] = useState(true)
  const [filterEnabled, setFilterEnabled] = useState(true)
  const [aiCoachOpen, setAiCoachOpen] = useState(false)
  const [aiCoachMsg, setAiCoachMsg] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontSize: '24px' }}>
      🛡️ Đang tải VitaShield...
    </div>
  )

  if (!user) return <Login onLogin={() => {}} />

  const totalAlerts = MOCK_ALERTS.filter(a => a.type === 'danger').length
  const child = selectedChild

  async function askAiCoach() {
    if (!aiCoachMsg.trim()) return
    setAiLoading(true)
    setAiResponse('')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: `Bạn là VitaShield AI Coach - chuyên gia tư vấn nuôi dạy con an toàn trên không gian mạng. 
Phụ huynh đang quản lý con tên ${child.name}, ${child.age} tuổi.
Điểm an toàn của con hôm nay: ${child.safetyScore}/100.
Số cảnh báo: ${child.alerts} cảnh báo.
Hãy đưa ra lời khuyên thực tế, ấm áp, cụ thể bằng tiếng Việt. Ngắn gọn dưới 150 từ.`,
          messages: [{ role: 'user', content: aiCoachMsg }],
        }),
      })
      const data = await res.json()
      setAiResponse(data.content?.[0]?.text || 'Xin lỗi, không thể kết nối AI lúc này.')
    } catch {
      setAiResponse('Không thể kết nối AI. Vui lòng thử lại.')
    }
    setAiLoading(false)
  }

  const pct = Math.min(100, Math.round((child.screenTimeToday / child.screenTimeLimit) * 100))
  const scoreColor = child.safetyScore >= 80 ? '#22c55e' : child.safetyScore >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">🛡️</span>
          <span className="logo-text">VitaShield</span>
        </div>

        <nav className="nav">
          {[
            { id: 'dashboard', icon: '📊', label: 'Tổng quan' },
            { id: 'children', icon: '👨‍👩‍👧‍👦', label: 'Quản lý con' },
            { id: 'filter', icon: '🔒', label: 'Lọc nội dung' },
            { id: 'screentime', icon: '⏱️', label: 'Thời gian màn hình' },
            { id: 'alerts', icon: '🔔', label: `Cảnh báo`, badge: totalAlerts },
            { id: 'reports', icon: '📈', label: 'Báo cáo' },
          ].map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge > 0 && <span className="badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-children">
          <p className="sidebar-label">Thiết bị con</p>
          {MOCK_CHILDREN.map(c => (
            <button
              key={c.id}
              className={`child-pill ${selectedChild.id === c.id ? 'active' : ''}`}
              onClick={() => setSelectedChild(c)}
            >
              <span>{c.avatar}</span>
              <span>{c.name}</span>
              <span className={`dot ${c.status}`}></span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Header */}
        <header className="header">
          <div>
            <h1 className="page-title">
              {activeTab === 'dashboard' && 'Tổng quan'}
              {activeTab === 'children' && 'Quản lý con'}
              {activeTab === 'filter' && 'Lọc nội dung'}
              {activeTab === 'screentime' && 'Thời gian màn hình'}
              {activeTab === 'alerts' && 'Cảnh báo'}
              {activeTab === 'reports' && 'Báo cáo'}
            </h1>
            <p className="page-sub">Đang xem: {child.name} · {child.device}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{user.email}</span>
            <button className="ai-coach-btn" onClick={() => setAiCoachOpen(true)}>
              🤖 AI Coach
            </button>
            <button onClick={() => signOut(auth)} style={{ background: '#1e2535', color: '#94a3b8', border: 'none', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', cursor: 'pointer' }}>
              Đăng xuất
            </button>
          </div>
        </header>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="content">
            {/* Stats row */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon green">🛡️</div>
                <div>
                  <div className="stat-value" style={{ color: scoreColor }}>{child.safetyScore}</div>
                  <div className="stat-label">Điểm an toàn</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue">⏱️</div>
                <div>
                  <div className="stat-value">{child.screenTimeToday}p</div>
                  <div className="stat-label">Màn hình hôm nay</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon red">🔔</div>
                <div>
                  <div className="stat-value">{child.alerts}</div>
                  <div className="stat-label">Cảnh báo</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon purple">📱</div>
                <div>
                  <div className="stat-value">{child.appsUsed.length}</div>
                  <div className="stat-label">App đã dùng</div>
                </div>
              </div>
            </div>

            <div className="two-col">
              {/* Screen time */}
              <div className="card">
                <h3 className="card-title">⏱️ Thời gian màn hình</h3>
                <div className="screen-time-display">
                  <div className="screen-time-nums">
                    <span className="big-num">{child.screenTimeToday}</span>
                    <span className="divider"> / </span>
                    <span className="limit">{child.screenTimeLimit} phút</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e'
                      }}
                    />
                  </div>
                  <p className="progress-label">{pct}% giới hạn hàng ngày</p>
                </div>

                <div className="app-list">
                  {MOCK_ACTIVITY.filter((_, i) => child.id === 1 ? i < 3 : true).map((a, i) => (
                    <div key={i} className="app-row">
                      <span className="app-icon">{a.icon}</span>
                      <span className="app-name">{a.app}</span>
                      <span className={`app-safe ${a.safe ? 'safe' : 'unsafe'}`}>
                        {a.safe ? '✓ An toàn' : '⚠ Chú ý'}
                      </span>
                      <span className="app-dur">{a.duration}p</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent alerts */}
              <div className="card">
                <h3 className="card-title">🔔 Cảnh báo gần đây</h3>
                <div className="alert-list">
                  {MOCK_ALERTS.filter(a => a.childId === child.id).map(a => (
                    <div key={a.id} className={`alert-row ${a.type}`}>
                      <span className="alert-icon">{a.icon}</span>
                      <div className="alert-content">
                        <p className="alert-title">{a.title}</p>
                        <p className="alert-desc">{a.desc}</p>
                        <p className="alert-time">{a.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Tab */}
        {activeTab === 'filter' && (
          <div className="content">
            <div className="card">
              <div className="toggle-row">
                <div>
                  <h3 className="card-title">🔒 Bộ lọc nội dung</h3>
                  <p className="card-sub">Chặn tự động nội dung không phù hợp</p>
                </div>
                <button
                  className={`toggle ${filterEnabled ? 'on' : 'off'}`}
                  onClick={() => setFilterEnabled(!filterEnabled)}
                >
                  {filterEnabled ? 'BẬT' : 'TẮT'}
                </button>
              </div>

              <div className="filter-cats">
                {[
                  { icon: '🔞', label: 'Nội dung 18+', on: true },
                  { icon: '🔫', label: 'Bạo lực', on: true },
                  { icon: '🎰', label: 'Cờ bạc', on: true },
                  { icon: '💊', label: 'Ma túy', on: true },
                  { icon: '😰', label: 'Tự làm hại', on: true },
                  { icon: '👾', label: 'Game không phù hợp', on: false },
                ].map((cat, i) => (
                  <div key={i} className="filter-cat">
                    <span>{cat.icon} {cat.label}</span>
                    <span className={`tag ${cat.on ? 'on' : 'off'}`}>{cat.on ? 'Đang chặn' : 'Tắt'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">🌐 Website bị chặn</h3>
              <div className="blocked-list">
                {['xxx-content.com', 'gambling-site.net', 'violent-games.io'].map((url, i) => (
                  <div key={i} className="blocked-url">
                    <span>🚫 {url}</span>
                    <button className="remove-btn">Xóa</button>
                  </div>
                ))}
              </div>
              <div className="add-url">
                <input className="url-input" placeholder="Thêm website cần chặn..." />
                <button className="add-btn">+ Thêm</button>
              </div>
            </div>
          </div>
        )}

        {/* Screen Time Tab */}
        {activeTab === 'screentime' && (
          <div className="content">
            <div className="card">
              <h3 className="card-title">⏱️ Giới hạn thời gian màn hình</h3>
              <div className="time-settings">
                <div className="time-row">
                  <span>Giới hạn mỗi ngày</span>
                  <div className="time-control">
                    <button className="time-btn">−</button>
                    <span className="time-val">{child.screenTimeLimit} phút</span>
                    <button className="time-btn">+</button>
                  </div>
                </div>
                <div className="time-row">
                  <div>
                    <span>Chế độ Bedtime 🌙</span>
                    <p className="card-sub">Khóa thiết bị lúc 21:30 – 06:00</p>
                  </div>
                  <button
                    className={`toggle ${bedtimeEnabled ? 'on' : 'off'}`}
                    onClick={() => setBedtimeEnabled(!bedtimeEnabled)}
                  >
                    {bedtimeEnabled ? 'BẬT' : 'TẮT'}
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">📱 Giới hạn theo ứng dụng</h3>
              <div className="app-limits">
                {[
                  { icon: '🎵', name: 'TikTok', limit: 30 },
                  { icon: '▶️', name: 'YouTube', limit: 60 },
                  { icon: '📷', name: 'Instagram', limit: 20 },
                  { icon: '🌐', name: 'Chrome', limit: 45 },
                ].map((app, i) => (
                  <div key={i} className="app-limit-row">
                    <span>{app.icon} {app.name}</span>
                    <div className="time-control">
                      <button className="time-btn">−</button>
                      <span className="time-val">{app.limit}p/ngày</span>
                      <button className="time-btn">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="content">
            <div className="card">
              <h3 className="card-title">🔔 Tất cả cảnh báo</h3>
              <div className="alert-list">
                {MOCK_ALERTS.map(a => (
                  <div key={a.id} className={`alert-row ${a.type}`}>
                    <span className="alert-icon">{a.icon}</span>
                    <div className="alert-content">
                      <div className="alert-header">
                        <p className="alert-title">{a.title}</p>
                        <span className={`tag ${a.type}`}>
                          {a.type === 'danger' ? 'Nguy hiểm' : a.type === 'warning' ? 'Cảnh báo' : 'Thông tin'}
                        </span>
                      </div>
                      <p className="alert-desc">{a.desc}</p>
                      <p className="alert-time">{MOCK_CHILDREN.find(c => c.id === a.childId)?.name} · {a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="content">
            <div className="card">
              <h3 className="card-title">📈 Báo cáo tuần này</h3>
              <div className="report-grid">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, i) => {
                  const val = [80, 110, 95, 130, 70, 150, 60][i]
                  const h = Math.round((val / 150) * 120)
                  return (
                    <div key={i} className="bar-col">
                      <div className="bar-wrap">
                        <div
                          className="bar"
                          style={{
                            height: `${h}px`,
                            background: val > 120 ? '#ef4444' : val > 100 ? '#f59e0b' : '#22c55e'
                          }}
                        />
                      </div>
                      <span className="bar-label">{day}</span>
                      <span className="bar-val">{val}p</span>
                    </div>
                  )
                })}
              </div>
              <div className="report-summary">
                <div className="summary-item"><span>Tổng thời gian tuần</span><strong>695 phút</strong></div>
                <div className="summary-item"><span>Trung bình mỗi ngày</span><strong>99 phút</strong></div>
                <div className="summary-item"><span>Ngày vượt giới hạn</span><strong style={{ color: '#ef4444' }}>2 ngày</strong></div>
                <div className="summary-item"><span>Tổng cảnh báo</span><strong style={{ color: '#f59e0b' }}>7 cảnh báo</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* Children Tab */}
        {activeTab === 'children' && (
          <div className="content">
            {MOCK_CHILDREN.map(c => (
              <div key={c.id} className="card child-card">
                <div className="child-header">
                  <div className="child-avatar">{c.avatar}</div>
                  <div>
                    <h3 className="child-name">{c.name}</h3>
                    <p className="card-sub">{c.age} tuổi · {c.device}</p>
                    <span className={`tag ${c.status === 'online' ? 'on' : 'off'}`}>
                      {c.status === 'online' ? '🟢 Đang online' : '⚫ Offline'}
                    </span>
                  </div>
                  <div className="child-score" style={{ color: c.safetyScore >= 80 ? '#22c55e' : c.safetyScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                    <div className="score-num">{c.safetyScore}</div>
                    <div className="score-label">Điểm an toàn</div>
                  </div>
                </div>
              </div>
            ))}
            <button className="add-child-btn">+ Thêm thiết bị con</button>
          </div>
        )}
      </main>

      {/* AI Coach Modal */}
      {aiCoachOpen && (
        <div className="modal-overlay" onClick={() => setAiCoachOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🤖 AI Co-Parenting Coach</h2>
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

            <textarea
              className="coach-input"
              placeholder="Nhập câu hỏi của bạn..."
              value={aiCoachMsg}
              onChange={e => setAiCoachMsg(e.target.value)}
              rows={3}
            />

            <button className="coach-send" onClick={askAiCoach} disabled={aiLoading}>
              {aiLoading ? '⏳ Đang phân tích...' : '💬 Hỏi AI Coach'}
            </button>

            {aiResponse && (
              <div className="coach-response">
                <p className="response-label">💡 Gợi ý từ AI Coach:</p>
                <p>{aiResponse}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}