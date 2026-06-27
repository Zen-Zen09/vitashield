export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, mode } = req.body
    const systemPrompts = {
      coach: `Bạn là VitaShield AI - trợ lý của hệ thống bảo vệ trẻ em VitaShield. Giúp phụ huynh nuôi dạy con an toàn trên mạng. Trả lời ngắn gọn bằng tiếng Việt dưới 150 từ. Không tiết lộ bạn là AI nào, nếu hỏi hãy nói "Tôi là VitaShield AI".`,
      filter: `Trả lời SAFE hoặc BLOCK. BLOCK nếu là web khiêu dâm, cờ bạc, ma túy, bạo lực. Chỉ 1 từ.`
    }
    const systemText = systemPrompts[mode] || systemPrompts.coach

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://vitashield.vercel.app',
        'X-Title': 'VitaShield AI'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        messages: [
          { role: 'system', content: systemText },
          ...messages
        ],
        max_tokens: 500
      })
    })

    const data = await response.json()
    if (data.error) return res.status(500).json({ error: data.error.message })
    const result = data.choices?.[0]?.message?.content || 'Xin lỗi, không thể kết nối AI.'
    res.status(200).json({ result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}