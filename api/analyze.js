module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Body inválido' }); }
  }

  const { keyword, mentions } = body || {};
  if (!keyword || !Array.isArray(mentions) || mentions.length === 0) {
    return res.status(400).json({ error: 'Faltan keyword o mentions' });
  }

  // Limitar a 40 menciones para no exceder tokens
  const sample = mentions.slice(0, 40).map((m, i) =>
    `[${i + 1}] Medio: ${m.source || '?'} | Fecha: ${m.date || '?'} | Tono: ${m.tono || '?'} | Titular: ${m.title || ''} | Extracto: ${(m.excerpt || '').slice(0, 180)}`
  ).join('\n');

  const systemPrompt = `Eres un analista experto en comunicación y monitoreo de medios.
Recibirás una lista de noticias sobre una keyword y deberás generar un análisis ejecutivo completo.
Responde EXCLUSIVAMENTE con un JSON válido con esta estructura exacta:
{
  "resumen": "Párrafo de 2-3 frases con el resumen ejecutivo general.",
  "tono_general": "positivo|neutro|negativo|mixto",
  "tono_descripcion": "1-2 frases explicando el tono predominante.",
  "temas": ["Tema clave 1", "Tema clave 2", "Tema clave 3", "Tema clave 4"],
  "hallazgos": ["Hallazgo concreto 1", "Hallazgo concreto 2", "Hallazgo concreto 3"],
  "medios_destacados": ["Medio A (N menciones)", "Medio B (N menciones)"],
  "conclusiones": "Párrafo conclusivo de 2-3 frases con la valoración final.",
  "recomendaciones": ["Recomendación de acción 1", "Recomendación de acción 2", "Recomendación de acción 3"]
}`;

  const userPrompt = `Keyword monitorizada: "${keyword}"
Total de menciones analizadas: ${mentions.length}

Noticias:
${sample}

Genera el análisis ejecutivo completo en español.`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.4
      })
    });

    const text = await openaiRes.text();
    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(500).json({ error: 'OpenAI no devolvió JSON', raw: text.slice(0, 200) });
    }

    if (data.error) return res.status(500).json({ error: data.error.message });

    const content = data?.choices?.[0]?.message?.content || '';
    const clean = content.replace(/```json|```/g, '').trim();
    const s = clean.indexOf('{');
    const e = clean.lastIndexOf('}');
    if (s === -1 || e === -1) return res.status(500).json({ error: 'Sin JSON en respuesta' });

    let parsed;
    try { parsed = JSON.parse(clean.slice(s, e + 1)); }
    catch { return res.status(500).json({ error: 'JSON malformado en respuesta' }); }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
