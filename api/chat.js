export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, mode } = req.body

    const systemPrompts = {
      coach: 'Ban la VitaShield AI - tro ly bao ve tre em. Tra loi bang tieng Viet. Khong dung markdown, khong dung **, ##, khong dung dau sao. Viet thanh doan van ngan gon duoi 100 tu. Neu duoc hoi ban la AI nao thi noi "Toi la VitaShield AI".',
      filter: 'Tra loi SAFE hoac BLOCK. BLOCK neu noi dung co: bao luc, khieu dam, co bac, ma tuy, tu lam hai, thu ghet, noi dung 18+, tieu cuc cho tre em. Chi tra loi 1 tu duy nhat.'
    }

    const system = systemPrompts[mode] || systemPrompts.coach

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: mode === 'filter' ? 10 : 200,
        system: system,
        messages: messages
      })
    })

    const data = await anthropicRes.json()

    if (data.error) {
      return res.status(500).json({ error: data.error.message })
    }

    const result = data.content && data.content[0] && data.content[0].text ? data.content[0].text : ''
    res.status(200).json({ result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}