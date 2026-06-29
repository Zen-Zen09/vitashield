export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { to_email, parent_name, child_name, blocked_url, device_name } = req.body

    if (!to_email || !blocked_url) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    const pName = parent_name || 'Phu huynh'
    const cName = child_name || 'Con'
    const dName = device_name || 'Thiet bi cua con'

    const html = [
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">',
      '<div style="background:linear-gradient(135deg,#1565C0,#00897B);padding:20px;border-radius:12px 12px 0 0;text-align:center">',
      '<h1 style="color:white;margin:0">VitaShield</h1>',
      '</div>',
      '<div style="background:#f9f9f9;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0">',
      '<p>Xin chao <strong>' + pName + '</strong>,</p>',
      '<p>VitaShield da chan mot trang web:</p>',
      '<p style="color:#e65100;font-weight:bold">' + blocked_url + '</p>',
      '<p>Ten con: ' + cName + '</p>',
      '<p>Thiet bi: ' + dName + '</p>',
      '<p>Thoi gian: ' + time + '</p>',
      '</div></div>'
    ].join('')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY
      },
      body: JSON.stringify({
        from: 'VitaShield <onboarding@resend.dev>',
        to: [to_email],
        subject: '[VitaShield] ' + cName + ' vua truy cap trang bi chan',
        html: html
      })
    })

    if (response.ok) {
      res.status(200).json({ ok: true, message: 'Email sent successfully' })
    } else {
      const err = await response.json()
      res.status(500).json({ error: 'Send failed: ' + (err.message || JSON.stringify(err)) })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}