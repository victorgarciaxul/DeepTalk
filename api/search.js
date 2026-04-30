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
            content: 'Eres un experto en clipping de medios. Responde EXCLUSIVAMENTE con un JSON valido, sin texto adicional. Formato exacto: {"total":numero,"mentions":[{"title":"...","source":"...","url":"https://...","date":"DD/MM/YYYY","excerpt":"..."}],"sources":[{"name":"...","count":numero}]}. SIN LIMITE de menciones: incluye ABSOLUTAMENTE TODAS las que encuentres. Excerpts breves de 1 frase. Incluye TODAS las fuentes posibles: periodicos nacionales (El Pais, El Mundo, ABC, La Vanguardia, El Confidencial, 20minutos, Publico, elDiario.es, OKDiario, La Razon, El Espanol, Expansion, Cinco Dias, El Economista, La Sexta, RTVE, Cadena SER, El Plural, InfoLibre, Libertad Digital, El Debate), periodicos regionales y locales de todas las comunidades autonomas, portales de noticias online, agencias de noticias (EFE, Europa Press, Reuters, AP), revistas especializadas de cualquier sector, medios de comunicacion internacionales que mencionen Espana, blogs especializados, medios sectoriales, foros relevantes, publicaciones de organismos oficiales y cualquier otra fuente digital donde aparezca la keyword.'
          },
          {
            role: 'user',
            content: 'Realiza una busqueda EXHAUSTIVA y SIN LIMITE de TODAS las menciones de "' + keyword + '" en cualquier medio digital: prensa nacional, regional y local espanola, medios internacionales, agencias de noticias, televisiones, radios online, portales especializados, blogs, foros y cualquier fuente online donde aparezca esta keyword. No omitas ninguna mencion, sin importar el tipo de medio. Devuelve TODAS las menciones que encuentres sin excepcion, ordenadas de mas reciente a mas antigua.'
          }
        ],
        max_tokens: 16000
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
