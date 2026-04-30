module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let keyword = req.query && req.query.keyword;
  const fromDate = (req.query && req.query.from) || '';
  const toDate   = (req.query && req.query.to)   || '';

  if (!keyword && req.body) {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    keyword = b && b.keyword;
  }
  if (!keyword) return res.status(400).json({ error: 'Falta el parámetro keyword' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });

  // Construir rango de fechas para el prompt
  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;

  let dateInstruction = '';
  if (fromDate && toDate) {
    // Convertir YYYY-MM-DD a DD/MM/YYYY para el prompt
    const fmt = d => { const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; };
    dateInstruction = `SOLO menciones publicadas entre el ${fmt(fromDate)} y el ${fmt(toDate)}. Excluye cualquier noticia fuera de ese rango.`;
  } else {
    // Por defecto: últimos 30 días
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const pastStr = `${String(past.getDate()).padStart(2,'0')}/${String(past.getMonth()+1).padStart(2,'0')}/${past.getFullYear()}`;
    dateInstruction = `SOLO menciones publicadas en los ultimos 30 dias (entre el ${pastStr} y el ${todayStr}). Excluye noticias anteriores a esa fecha.`;
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        web_search_options: { search_context_size: 'high' },
        messages: [
          {
            role: 'system',
            content: `Eres un experto en clipping de medios. Responde EXCLUSIVAMENTE con un JSON valido, sin texto adicional. Formato exacto: {"total":numero,"mentions":[{"title":"...","source":"...","url":"https://...","date":"DD/MM/YYYY","excerpt":"..."}],"sources":[{"name":"...","count":numero}]}. ${dateInstruction} SIN LIMITE de menciones: incluye ABSOLUTAMENTE TODAS las que encuentres en ese periodo. El campo "date" DEBE ser la fecha real de publicacion del articulo en formato DD/MM/YYYY. Excerpts breves de 1 frase. Incluye TODAS las fuentes: El Pais, El Mundo, ABC, La Vanguardia, El Confidencial, 20minutos, Publico, elDiario.es, OKDiario, La Razon, El Espanol, Expansion, Cinco Dias, El Economista, La Sexta, RTVE, Cadena SER, El Plural, InfoLibre, Libertad Digital, El Debate, Europa Press, EFE, Reuters, AP, medios regionales de todas las CCAA, revistas especializadas, medios internacionales y cualquier otra fuente digital.`
          },
          {
            role: 'user',
            content: `Busca TODAS las menciones de "${keyword}" publicadas ${fromDate && toDate ? `entre ${fromDate} y ${toDate}` : 'en los ultimos 30 dias'}. Incluye prensa nacional, regional y local espanola, medios internacionales, agencias de noticias, televisiones, radios online, portales especializados y cualquier fuente online. Ordena de mas reciente a mas antigua. La fecha de cada mencion debe ser la fecha REAL de publicacion del articulo.`
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

    var parsed;
    try { parsed = JSON.parse(clean.slice(s, e + 1)); }
    catch (_) {
      try { parsed = JSON.parse(clean.slice(s, e + 1) + ']}'); }
      catch (__) { return res.status(500).json({ error: 'JSON malformado' }); }
    }

    // Filtrar por fecha en servidor para asegurar que no llegan noticias antiguas
    if (parsed.mentions && (fromDate || toDate)) {
      const parseDate = str => {
        if (!str) return null;
        const [d, m, y] = str.split('/');
        if (!y) return null;
        return new Date(y, m - 1, d).getTime();
      };
      const from = fromDate ? new Date(fromDate).getTime() : null;
      const to   = toDate   ? new Date(toDate + 'T23:59:59').getTime() : null;
      parsed.mentions = parsed.mentions.filter(m => {
        const t = parseDate(m.date);
        if (!t) return true; // sin fecha: dejar pasar
        if (from && t < from) return false;
        if (to   && t > to)   return false;
        return true;
      });
      parsed.total = parsed.mentions.length;
    } else if (parsed.mentions) {
      // Sin filtro de fechas: descartar noticias con más de 30 días
      const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      const parseDate = str => {
        if (!str) return null;
        const [d, m, y] = str.split('/');
        if (!y) return null;
        return new Date(y, m - 1, d).getTime();
      };
      parsed.mentions = parsed.mentions.filter(m => {
        const t = parseDate(m.date);
        if (!t) return true;
        return t >= cutoff;
      });
      parsed.total = parsed.mentions.length;
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
