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
    const pName = parent_name || 'Phụ huynh'
    const cName = child_name || 'Con'
    const dName = device_name || 'Thiết bị của con'

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'VitaShield <onboarding@resend.dev>',
        to: [to_email],
        subject: `⚠️ VitaShield: ${cName} vừa truy cập trang bị chặn`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1565C0, #00897B); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🛡️ VitaShield</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Cảnh báo truy cập</p>
            </div>
            <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e0e0e0;">
              <p style="font-size: 16px;">Xin chào <strong>${pName}</strong>,</p>
              <p style="color: #555;">VitaShield đã phát hiện và chặn một trang web không phù hợp:</p>
              <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
                <p style="margin: 0; font-size: 13px; color: #888;">Trang bị chặn</p>
                <p style="margin: 4px 0 0 0; font-weight: bold; color: #e65100; word-break: break-all;">${blocked_url}</p>
              </div>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr>
                  <td style="padding: 8px; color: #666; width: 40%;">👦 Tên con:</td>
                  <td style="padding: 8px; font-weight: bold;">${cName}</td>
                </tr>
                <tr style="background: #f5f5f5;">
                  <td style="padding: 8px; color: #666;">📱 Thiết bị:</td>
                  <td style="padding: 8px; font-weight: bold;">${dName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; color: #666;">🕐 Thời gian:</td>
                  <td style="padding: 8px; font-weight: bold;">${time}</td>
                </tr>
              </table>
              <p style="color: #888; font-size: 13px; margin-top: 24px;">Email này được gửi tự động từ VitaShield. Vui lòng không trả lời.</p>
            </div>
          </div>
        `
      })
    })

    if (response.ok) {
      res.status(200).json({ ok: true, message: 'Email đã gửi thành công' })
    } else {
      const err = await response.json()
      res.status(500).json({ error: 'Gửi email thất bại: ' + (err.message || JSON.stringify(err)) })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}