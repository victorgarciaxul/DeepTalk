export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'keyword required' });

  const apiKey = process.env.VITE_OA_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OpenAI key not configured' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `Eres un experto en clipping. Responde EXCLUSIVAMENTE con un JSON válido. No escribas nada más.
            Formato: {"total":número,"mentions":[{"title":"...","source":"...","url":"https://...","date":"DD/MM/YYYY","excerpt":"..."}],"sources":[{"name":"...","count":número}]}.
            Busca hasta 20 menciones. Excerpts breves de 1 frase.`
          },
          {
            role: 'user',
            content: `Busca menciones recientes de "${keyword}" en prensa digital de España.`
          }
        ],
        max_tokens: 4096
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const content = data?.choices?.[0]?.message?.content;
    if (!content) return res.status(500).json({ error: 'Sin respuesta de OpenAI' });

    let clean = content.replace(/```json|```/g, '').trim();
    const s = clean.indexOf('{');
    const e = clean.lastIndexOf('}');
    if (s === -1 || e === -1) return res.status(500).json({ error: 'JSON inválido' });

    try {
      const result = JSON.parse(clean.slice(s, e + 1));
      return res.status(200).json(result);
    } catch {
      try {
        const result = JSON.parse(clean.slice(s, e + 1) + ']}');
        return res.status(200).json(result);
      } catch {
        return res.status(500).json({ error: 'Error parseando respuesta' });
      }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
