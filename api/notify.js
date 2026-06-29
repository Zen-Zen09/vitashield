export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { to_email, parent_name, child_name, blocked_url, device_name } = req.body

    if (!to_email || !blocked_url) {
      return res.status(400).json({ error: 'Thiếu thông tin' })
    }

    const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: 'service_33w1bh6',
        template_id: '84no68i',
        user_id: 'Qqs9B-Hf2vqDfwE3k',
        accessToken: '4qModiBk_gZIUem5Vx49b',
        template_params: {
          to_email,
          parent_name: parent_name || 'Phụ huynh',
          child_name: child_name || 'Con',
          blocked_url,
          time,
          device_name: device_name || 'Thiết bị của con',
          name: 'VitaShield',
          email: 'noreply@vitashield.app'
        }
      })
    })

    if (response.ok) {
      res.status(200).json({ ok: true, message: 'Email đã gửi thành công' })
    } else {
      const err = await response.text()
      res.status(500).json({ error: 'Gửi email thất bại: ' + err })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}