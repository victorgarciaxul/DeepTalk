module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Acepta keyword desde query string (?keyword=...) o desde body JSON
  let keyword = req.query && req.query.keyword;

  if (!keyword && req.body) {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    keyword = b && b.keyword;
  }

  if (!keyword) return res.status(400).json({ error: 'Falta el parámetro keyword' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        web_search_options: {
          search_context_size: 'high'
        },
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en clipping de medios. Responde EXCLUSIVAMENTE con un JSON valido, sin texto adicional. Formato exacto: {"total":numero,"mentions":[{"title":"...","source":"...","url":"https://...","date":"DD/MM/YYYY","excerpt":"..."}],"sources":[{"name":"...","count":numero}]}. Busca el maximo de menciones posible, hasta 50. Excerpts breves de 1 frase. Incluye TODAS las fuentes disponibles: periodicos nacionales (El Pais, El Mundo, ABC, La Vanguardia, El Confidencial, 20minutos, Publico, elDiario.es, OKDiario, La Razon, El Espanol, Expansion, Cinco Dias, El Economista), periodicos regionales, portales de noticias online, agencias de noticias (EFE, Europa Press), revistas especializadas, medios de comunicacion internacionales que cubran Espana, blogs especializados, medios sectoriales y cualquier otra fuente digital relevante.'
          },
          {
            role: 'user',
            content: 'Realiza una busqueda exhaustiva de TODAS las menciones recientes de "' + keyword + '" en todo tipo de medios digitales: prensa nacional y regional espanola, medios internacionales, agencias de noticias, portales especializados y cualquier fuente online relevante. No limites la busqueda a ningun tipo concreto de medio. Devuelve todas las menciones que encuentres, ordenadas de mas reciente a mas antigua.'
          }
        ],
        max_tokens: 8192
      })
    });

    const text = await openaiRes.text();
    var data;
    try { data = JSON.parse(text); } catch (e) {
      return res.status(500).json({ error: 'OpenAI no devolvio JSON', raw: text.slice(0, 200) });
    }

    if (data.error) return res.status(500).json({ error: data.error.message });

    var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) return res.status(500).json({ error: 'Sin contenido en respuesta OpenAI' });

    var clean = content.replace(/```json|```/g, '').trim();
    var s = clean.indexOf('{');
    var e = clean.lastIndexOf('}');
    if (s === -1 || e === -1) return res.status(500).json({ error: 'Sin JSON en respuesta' });

    try {
      return res.status(200).json(JSON.parse(clean.slice(s, e + 1)));
    } catch (_) {
      try { return res.status(200).json(JSON.parse(clean.slice(s, e + 1) + ']}'));
      } catch (__) { return res.status(500).json({ error: 'JSON malformado' }); }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
