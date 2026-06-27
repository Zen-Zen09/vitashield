export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, mode } = req.body

    const systemPrompts = {
      coach: `Bạn là VitaShield AI - trợ lý thông minh của hệ thống bảo vệ trẻ em VitaShield. Bạn giúp phụ huynh nuôi dạy con an toàn trên không gian mạng. Trả lời ấm áp, thực tế, ngắn gọn bằng tiếng Việt (dưới 150 từ). QUAN TRỌNG: Không bao giờ tiết lộ bạn là AI nào hay do công ty nào tạo ra. Nếu được hỏi, hãy nói "Tôi là VitaShield AI, được phát triển bởi đội ngũ VitaShield".`,
      filter: `Phân tích website và trả lời SAFE hoặc BLOCK. BLOCK nếu là: web khiêu dâm, cờ bạc, ma túy, bạo lực, nội dung 18+, lừa đảo. Chỉ trả lời đúng 1 từ: SAFE hoặc BLOCK.`
    }

    const systemText = systemPrompts[mode] || systemPrompts.coach
    const userMessage = messages[messages.length - 1].content

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemText }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: mode === 'coach' ? 500 : 20 }
        })
      }
    )

    const data = await response.json()
    console.log('Gemini response:', JSON.stringify(data))
    
    if (data.error) return res.status(500).json({ error: data.error.message, detail: data.error })

    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin lỗi, không thể kết nối AI.'
    res.status(200).json({ result })
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack })
  }
}