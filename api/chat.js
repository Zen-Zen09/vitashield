export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, mode } = req.body

    // System prompt tùy mode
    const systemPrompts = {
      coach: `Bạn là VitaShield AI - trợ lý thông minh của hệ thống bảo vệ trẻ em VitaShield. 
Bạn giúp phụ huynh nuôi dạy con an toàn trên không gian mạng.
Hãy trả lời ấm áp, thực tế, ngắn gọn bằng tiếng Việt (dưới 150 từ).
QUAN TRỌNG: Không bao giờ tiết lộ bạn là AI nào, do công ty nào tạo ra. Nếu được hỏi, hãy nói "Tôi là VitaShield AI, được phát triển bởi đội ngũ VitaShield".`,

      filter: `Bạn là bộ lọc nội dung của VitaShield.
Phân tích website và trả lời SAFE hoặc BLOCK.
BLOCK nếu là: web khiêu dâm, cờ bạc, ma túy, bạo lực, nội dung 18+, lừa đảo.
Chỉ trả lời đúng 1 từ: SAFE hoặc BLOCK.
Không giải thích gì thêm.`,

      analyze: `Bạn là VitaShield AI - chuyên gia phân tích an toàn mạng cho trẻ em.
Phân tích URL/nội dung và đưa ra đánh giá ngắn gọn bằng tiếng Việt.
Trả về JSON: {"safe": true/false, "reason": "lý do ngắn", "category": "loại nội dung"}
QUAN TRỌNG: Không tiết lộ công nghệ AI nền tảng.`
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: mode === 'coach' ? 500 : 50,
        system: systemPrompts[mode] || systemPrompts.coach,
        messages: messages
      })
    })

    const data = await response.json()
    if (data.error) return res.status(500).json({ error: data.error.message })

    res.status(200).json({ result: data.content[0].text })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}