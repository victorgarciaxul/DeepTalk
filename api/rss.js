module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const keyword = (req.query && req.query.keyword) || '';
  if (!keyword) return res.status(400).json({ error: 'Falta keyword' });

  // Fuentes RSS: Google News cubre prensa, radio, TV y digital de todos los medios
  const sources = [
    // Google News España (agrega TODOS los medios automáticamente)
    `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=es&gl=ES&ceid=ES:es`,
    // Medios directos más importantes
    `https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada`,
    `https://www.elmundo.es/rss/portada.xml`,
    `https://www.abc.es/rss/feeds/abc_espana.xml`,
    `https://www.lavanguardia.com/rss/home.xml`,
    `https://rss.elconfidencial.com/espana/`,
    `https://www.20minutos.es/rss/`,
    `https://www.publico.es/rss/portada`,
    `https://www.eldiario.es/rss/`,
    `https://www.expansion.com/rss/portada.xml`,
    `https://www.cadenaser.com/rss/cadenaser.com/portada.xml`,
    `https://www.rtve.es/api/noticias.rss`,
  ];

  const allMentions = [];
  const seen = new Set();
  const kw = keyword.toLowerCase();

  async function fetchRSS(url) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeepTalkBot/1.0)' }
      });
      clearTimeout(t);
      if (!r.ok) return [];
      const xml = await r.text();

      // Parse <item> blocks from RSS
      const items = [];
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      let m;
      while ((m = itemRegex.exec(xml)) !== null) {
        const block = m[1];

        const getTag = (tag) => {
          const match = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
          return match ? (match[1] || match[2] || '').trim() : '';
        };

        const title = getTag('title');
        const link = (block.match(/<link[^>]*>(.*?)<\/link>/i) || block.match(/<link>(.*?)<\/link>/i) || [])[1] || '';
        const pubDate = getTag('pubDate');
        const description = getTag('description');
        const sourceTag = (block.match(/<source[^>]*>(.*?)<\/source>/i) || [])[1] || '';

        // Filtrar por keyword en título o descripción
        const combined = (title + ' ' + description).toLowerCase();
        if (!combined.includes(kw)) continue;
        if (!link || !title) continue;

        // Deduplicar por URL
        const cleanUrl = link.replace(/^https?:\/\/(www\.)?/, '').split('?')[0];
        if (seen.has(cleanUrl)) continue;
        seen.add(cleanUrl);

        // Extraer nombre del medio
        let source = sourceTag;
        if (!source) {
          try { source = new URL(link).hostname.replace('www.', ''); } catch { source = url.split('/')[2] || 'Desconocido'; }
        }

        // Parsear fecha
        let date = '';
        if (pubDate) {
          try {
            const d = new Date(pubDate);
            if (!isNaN(d.getTime())) {
              date = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
            }
          } catch {}
        }

        items.push({
          title: title.replace(/ - [^-]+$/, '').trim(), // quitar "- Fuente" del título de Google News
          source,
          url: link,
          date,
          excerpt: description.replace(/<[^>]+>/g, '').slice(0, 200)
        });
      }
      return items;
    } catch (e) {
      return [];
    }
  }

  // Fetch en paralelo con timeout global de 20s
  const results = await Promise.allSettled(sources.map(fetchRSS));
  for (const r of results) {
    if (r.status === 'fulfilled') allMentions.push(...r.value);
  }

  // Ordenar por fecha (más reciente primero)
  allMentions.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    const parse = d => {
      const [day, month, year] = d.split('/');
      return new Date(year, month - 1, day).getTime();
    };
    return parse(b.date) - parse(a.date);
  });

  const sourceMap = {};
  for (const m of allMentions) sourceMap[m.source] = (sourceMap[m.source] || 0) + 1;
  const sources_summary = Object.entries(sourceMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return res.status(200).json({
    total: allMentions.length,
    mentions: allMentions,
    sources: sources_summary
  });
};
