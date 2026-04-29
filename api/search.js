module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const keyword = body && body.keyword;
  if (!keyword) return res.status(400).json({ error: 'keyword required' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        web_search_options: {},
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en clipping. Responde EXCLUSIVAMENTE con un JSON valido. Formato: {"total":numero,"mentions":[{"title":"...","source":"...","url":"https://...","date":"DD/MM/YYYY","excerpt":"..."}],"sources":[{"name":"...","count":numero}]}. Busca hasta 20 menciones. Excerpts breves de 1 frase.'
          },
          {
            role: 'user',
            content: 'Busca menciones recientes de "' + keyword + '" en prensa digital de Espana.'
          }
        ],
        max_tokens: 4096
      })
    });

    const text = await openaiRes.text();
    var data;
    try { data = JSON.parse(text); } catch (e) { return res.status(500).json({ error: 'OpenAI no devolvio JSON', raw: text.slice(0, 300) }); }

    if (data.error) return res.status(500).json({ error: data.error.message, code: data.error.code });

    var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) return res.status(500).json({ error: 'OpenAI sin contenido', raw: JSON.stringify(data).slice(0, 300) });

    var clean = content.replace(/```json|```/g, '').trim();
    var s = clean.indexOf('{');
    var e = clean.lastIndexOf('}');
    if (s === -1 || e === -1) return res.status(500).json({ error: 'No hay JSON', content: content.slice(0, 300) });

    try {
      return res.status(200).json(JSON.parse(clean.slice(s, e + 1)));
    } catch (err1) {
      try { return res.status(200).json(JSON.parse(clean.slice(s, e + 1) + ']}'));
      } catch (err2) { return res.status(500).json({ error: 'JSON malformado', content: content.slice(0, 200) }); }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
