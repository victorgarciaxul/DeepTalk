export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const keyword = body?.keyword;
  if (!keyword) return res.status(400).json({ error: 'keyword required' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        web_search_options: {},
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en clipping. Responde EXCLUSIVAMENTE con un JSON válido. No escribas nada más. Formato: {"total":número,"mentions":[{"title":"...","source":"...","url":"https://...","date":"DD/MM/YYYY","excerpt":"..."}],"sources":[{"name":"...","count":número}]}. Busca hasta 20 menciones. Excerpts breves de 1 frase.'
          },
          {
            role: 'user',
            content: `Busca menciones recientes de "${keyword}" en prensa digital de España.`
          }
        ],
        max_tokens: 4096
      })
    });

    const text = await openaiRes.text();
    let data;
    try { data = JSON.parse(text); } catch { return res.status(500).json({ error: 'OpenAI respuesta no es JSON', raw: text.slice(0, 300) }); }

    if (data.error) return res.status(500).json({ error: data.error.message, code: data.error.code });

    const content = data?.choices?.[0]?.message?.content;
    if (!content) return res.status(500).json({ error: 'OpenAI sin contenido', raw: JSON.stringify(data).slice(0, 300) });

    const clean = content.replace(/```json|```/g, '').trim();
    const s = clean.indexOf('{');
    const e = clean.lastIndexOf('}');
    if (s === -1 || e === -1) return res.status(500).json({ error: 'No hay JSON en respuesta', content: content.slice(0, 300) });

    try {
      return res.status(200).json(JSON.parse(clean.slice(s, e + 1)));
    } catch {
      try { return res.status(200).json(JSON.parse(clean.slice(s, e + 1) + ']}'));
      } catch { return res.status(500).json({ error: 'JSON malformado', content: content.slice(0, 300) }); }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.slice(0, 300) });
  }
}
