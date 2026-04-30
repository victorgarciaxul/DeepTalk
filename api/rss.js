module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const keyword  = (req.query && req.query.keyword)  || '';
  const fromDate = (req.query && req.query.from)      || '';
  const toDate   = (req.query && req.query.to)        || '';

  if (!keyword) return res.status(400).json({ error: 'Falta keyword' });

  // Rango de fechas (ms) para filtrar
  const now     = Date.now();
  const cutoff  = fromDate
    ? new Date(fromDate).getTime()
    : now - 30 * 24 * 60 * 60 * 1000; // últimos 30 días por defecto
  const ceiling = toDate
    ? new Date(toDate + 'T23:59:59').getTime()
    : now;

  const kw = keyword.toLowerCase();

  // Google News con variantes para más cobertura
  const googleBase = `https://news.google.com/rss/search?hl=es&gl=ES&ceid=ES:es&q=`;
  const rssUrls = [
    // Google News — keyword exacta
    googleBase + encodeURIComponent(`"${keyword}"`),
    // Google News — keyword sin comillas (más resultados)
    googleBase + encodeURIComponent(keyword),
    // Google News — keyword + España
    googleBase + encodeURIComponent(`${keyword} España`),
    // Google News — keyword + prensa
    googleBase + encodeURIComponent(`${keyword} noticias`),

    // Agencias de noticias
    `https://www.europapress.es/rss/rss.aspx`,
    // Prensa nacional
    `https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada`,
    `https://www.elmundo.es/rss/portada.xml`,
    `https://www.abc.es/rss/feeds/abc_espana.xml`,
    `https://www.lavanguardia.com/rss/home.xml`,
    `https://rss.elconfidencial.com/espana/`,
    `https://www.20minutos.es/rss/`,
    `https://www.publico.es/rss/portada`,
    `https://www.eldiario.es/rss/`,
    `https://www.elespanol.com/rss/`,
    `https://okdiario.com/feed`,
    `https://www.infolibre.es/rss`,
    `https://www.libertaddigital.com/rss/portada.xml`,
    // Prensa económica
    `https://www.expansion.com/rss/portada.xml`,
    `https://www.cincodias.elpais.com/rss/feed.html`,
    `https://www.eleconomista.es/rss/rss-ultima-hora.php`,
    // Radio y TV
    `https://www.cadenaser.com/rss/cadenaser.com/portada.xml`,
    `https://www.rtve.es/api/noticias.rss`,
    `https://www.cope.es/rss`,
    `https://www.ondacero.es/rss/`,
    // Regionales
    `https://www.elperiodico.com/es/rss/rss_portada.xml`,
    `https://www.heraldo.es/rss/portada.xml`,
    `https://www.elcorreo.com/rss/portada.xml`,
    `https://www.lasprovincias.es/rss/portada.xml`,
    `https://www.laopiniondezamora.es/rss/portada.xml`,
    `https://www.elcomercio.es/rss/portada.xml`,
    `https://www.elnortedecastilla.es/rss/portada.xml`,
  ];

  const allMentions = [];
  const seen = new Set();

  async function fetchRSS(url) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeepTalkBot/1.0; +https://deeptalk.xul.es)' }
      });
      clearTimeout(t);
      if (!r.ok) return [];
      const xml = await r.text();

      const items = [];
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      let m;
      while ((m = itemRegex.exec(xml)) !== null) {
        const block = m[1];

        const getTag = (tag) => {
          const rx = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
          const match = block.match(rx);
          return match ? (match[1] || match[2] || '').trim() : '';
        };

        const title       = getTag('title');
        const description = getTag('description');
        const pubDate     = getTag('pubDate');
        const sourceTag   = (block.match(/<source[^>]*>(.*?)<\/source>/i) || [])[1] || '';

        // Extraer link (puede estar como <link> o como <guid isPermaLink="true">)
        let link = '';
        const linkMatch = block.match(/<link>([^<]+)<\/link>/i)
          || block.match(/<link[^>]*href="([^"]+)"/i)
          || block.match(/<guid[^>]*isPermaLink="true"[^>]*>([^<]+)<\/guid>/i);
        if (linkMatch) link = linkMatch[1].trim();

        if (!link || !title) continue;

        // Filtrar por keyword en título o descripción
        const combined = (title + ' ' + description).toLowerCase();
        // Para feeds genéricos (no Google News) exigir que aparezca la keyword
        const isGoogleNews = url.includes('news.google.com');
        if (!isGoogleNews && !combined.includes(kw)) continue;

        // Filtrar por fecha de publicación
        let pubMs = null;
        let dateStr = '';
        if (pubDate) {
          try {
            const d = new Date(pubDate);
            if (!isNaN(d.getTime())) {
              pubMs = d.getTime();
              dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
            }
          } catch {}
        }

        // Descartar artículos fuera del rango de fechas
        if (pubMs !== null) {
          if (pubMs < cutoff)  continue;
          if (pubMs > ceiling) continue;
        }

        // Deduplicar
        const cleanUrl = link.replace(/^https?:\/\/(www\.)?/, '').split('?')[0];
        if (seen.has(cleanUrl)) continue;
        seen.add(cleanUrl);

        // Nombre del medio
        let source = sourceTag;
        if (!source) {
          try { source = new URL(link).hostname.replace('www.', ''); } catch { source = 'Desconocido'; }
        }

        items.push({
          title: title.replace(/ [-–|] [^-–|]+$/, '').trim(),
          source,
          url: link,
          date: dateStr,
          excerpt: description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 250)
        });
      }
      return items;
    } catch {
      return [];
    }
  }

  const results = await Promise.allSettled(rssUrls.map(fetchRSS));
  for (const r of results) {
    if (r.status === 'fulfilled') allMentions.push(...r.value);
  }

  // Deduplicar global (distintos feeds pueden traer el mismo artículo)
  const finalMentions = [];
  const seenFinal = new Set();
  for (const m of allMentions) {
    const key = m.url.replace(/^https?:\/\/(www\.)?/, '').split('?')[0];
    if (!seenFinal.has(key)) {
      seenFinal.add(key);
      finalMentions.push(m);
    }
  }

  // Ordenar por fecha desc
  finalMentions.sort((a, b) => {
    const parse = d => { if (!d) return 0; const [dd,mm,yy] = d.split('/'); return new Date(yy, mm-1, dd).getTime(); };
    return parse(b.date) - parse(a.date);
  });

  const sourceMap = {};
  for (const m of finalMentions) sourceMap[m.source] = (sourceMap[m.source] || 0) + 1;
  const sources_summary = Object.entries(sourceMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return res.status(200).json({
    total: finalMentions.length,
    mentions: finalMentions,
    sources: sources_summary
  });
};
