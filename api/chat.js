export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, mode } = req.body
    const systemPrompts = {
      coach: `Bạn là VitaShield AI - trợ lý của hệ thống bảo vệ trẻ em VitaShield. Giúp phụ huynh nuôi dạy con an toàn trên mạng. Trả lời ngắn gọn bằng tiếng Việt dưới 150 từ. Không tiết lộ bạn là AI nào.`,
      filter: `Trả lời SAFE hoặc BLOCK. BLOCK nếu là web khiêu dâm, cờ bạc, ma túy, bạo lực. Chỉ 1 từ.`
    }
    const userMessage = messages[messages.length - 1].content
    const systemText = systemPrompts[mode] || systemPrompts.coach

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemText }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 500 }
        })
      }
    )

    const text = await response.text()
    console.log('Raw response:', text)
    const data = JSON.parse(text)

    if (data.error) return res.status(500).json({ error: data.error.message })
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin lỗi, không thể kết nối AI.'
    res.status(200).json({ result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}