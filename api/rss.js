module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const keyword  = (req.query && req.query.keyword)  || '';
  const fromDate = (req.query && req.query.from)      || '';
  const toDate   = (req.query && req.query.to)        || '';

  if (!keyword) return res.status(400).json({ error: 'Falta keyword' });

  // Normalizar keyword: quitar tildes y pasar a minúsculas para matching flexible
  const normalize = str => str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
    .replace(/[^a-z0-9\s]/g, ' ').trim();

  const kwNorm = normalize(keyword);
  const kwWords = kwNorm.split(/\s+/).filter(w => w.length > 2); // palabras relevantes

  // Un artículo coincide si contiene TODAS las palabras de la keyword (sin tildes)
  const matchesKeyword = (text) => {
    const textNorm = normalize(text);
    return kwWords.every(w => textNorm.includes(w));
  };

  // Rango de fechas (ms)
  const now     = Date.now();
  const cutoff  = fromDate ? new Date(fromDate).getTime() : now - 30 * 24 * 60 * 60 * 1000;
  const ceiling = toDate   ? new Date(toDate + 'T23:59:59').getTime() : now;

  const googleBase = `https://news.google.com/rss/search?hl=es&gl=ES&ceid=ES:es&q=`;

  // Variantes de búsqueda en Google News (keyword + versiones sin tildes)
  const kwEncoded       = encodeURIComponent(keyword);
  const kwNormEncoded   = encodeURIComponent(normalize(keyword));

  const rssUrls = [
    // === GOOGLE NEWS — máxima cobertura con variantes ===
    googleBase + encodeURIComponent(`"${keyword}"`),
    googleBase + kwEncoded,
    googleBase + kwNormEncoded,
    googleBase + encodeURIComponent(`${keyword} España`),
    googleBase + encodeURIComponent(`${keyword} Andalucía`),
    googleBase + encodeURIComponent(`${keyword} noticias`),

    // === AGENCIAS ===
    `https://www.europapress.es/rss/rss.aspx`,
    `https://www.europapress.es/andalucia/rss/rss.aspx`,

    // === PRENSA NACIONAL ===
    `https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada`,
    `https://www.elmundo.es/rss/portada.xml`,
    `https://www.abc.es/rss/feeds/abc_espana.xml`,
    `https://www.abc.es/rss/feeds/abc_andalucia.xml`,
    `https://www.lavanguardia.com/rss/home.xml`,
    `https://rss.elconfidencial.com/espana/`,
    `https://www.20minutos.es/rss/`,
    `https://www.publico.es/rss/portada`,
    `https://www.eldiario.es/rss/`,
    `https://www.elespanol.com/rss/`,
    `https://okdiario.com/feed`,
    `https://www.infolibre.es/rss`,
    `https://www.libertaddigital.com/rss/portada.xml`,

    // === PRENSA ECONÓMICA ===
    `https://www.expansion.com/rss/portada.xml`,
    `https://www.eleconomista.es/rss/rss-ultima-hora.php`,

    // === RADIO Y TV ===
    `https://www.cadenaser.com/rss/cadenaser.com/portada.xml`,
    `https://www.rtve.es/api/noticias.rss`,
    `https://www.cope.es/rss`,
    `https://www.ondacero.es/rss/`,

    // === MEDIOS DIGITALES ANDALUCES (del listado MyNews) ===
    `https://www.diariodesevilla.es/rss/portada.xml`,
    `https://www.diariodecadiz.es/rss/portada.xml`,
    `https://www.diariocordoba.com/rss/portada.xml`,
    `https://www.diariodealmeria.es/rss/portada.xml`,
    `https://www.granadahoy.com/rss/portada.xml`,
    `https://www.malagahoy.es/rss/portada.xml`,
    `https://www.huelvainformacion.es/rss/portada.xml`,
    `https://www.jaenhoy.es/rss/portada.xml`,
    `https://www.diariosur.es/rss/portada.xml`,
    `https://www.europasur.es/rss/portada.xml`,
    `https://www.eldiadecordoba.es/rss/portada.xml`,
    `https://www.laopiniondemalaga.es/rss/portada.xml`,
    `https://www.lavozdealmeria.com/rss`,
    `https://www.ahoragranada.com/feed/`,
    `https://www.cordobahoy.es/feed/`,
    `https://www.noticiasdealmeria.com/rss/portada.xml`,
    `https://www.agrodiariohuelva.es/feed/`,
    `https://sevilla.abc.es/rss/feeds/abc_sevilla.xml`,

    // === REGIONALES NACIONALES ===
    `https://www.elperiodico.com/es/rss/rss_portada.xml`,
    `https://www.heraldo.es/rss/portada.xml`,
    `https://www.elcorreo.com/rss/portada.xml`,
    `https://www.lasprovincias.es/rss/portada.xml`,
    `https://www.elcomercio.es/rss/portada.xml`,
    `https://www.elnortedecastilla.es/rss/portada.xml`,
    `https://www.lavozdegalicia.es/rss/portada.xml`,
    `https://www.elperiodico.com/es/rss/rss_portada.xml`,
    `https://www.laverdad.es/rss/portada.xml`,
    `https://www.sur.es/rss/portada.xml`,
    `https://www.ideal.es/rss/portada.xml`,
    `https://www.huelvabuenas.es/feed/`,
  ];

  const allMentions = [];
  const seen = new Set();

  function parseDate(pubDate) {
    if (!pubDate) return { pubMs: null, dateStr: '' };
    try {
      const d = new Date(pubDate);
      if (isNaN(d.getTime())) return { pubMs: null, dateStr: '' };
      return {
        pubMs: d.getTime(),
        dateStr: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
      };
    } catch { return { pubMs: null, dateStr: '' }; }
  }

  function extractLink(block) {
    // Google News usa <link> con CDATA o texto, o <guid>
    const patterns = [
      /<link>([^<\s]+)<\/link>/i,
      /<link><!\[CDATA\[([^\]]+)\]\]><\/link>/i,
      /<link[^>]+href="([^"]+)"/i,
      /<guid[^>]*isPermaLink="true"[^>]*>([^<]+)<\/guid>/i,
      /<guid>([^<]+)<\/guid>/i,
    ];
    for (const p of patterns) {
      const m = block.match(p);
      if (m && m[1] && m[1].startsWith('http')) return m[1].trim();
    }
    return '';
  }

  async function fetchRSS(url) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      clearTimeout(t);
      if (!r.ok) return [];
      const xml = await r.text();
      if (!xml.includes('<item')) return [];

      const items = [];
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      let m;
      while ((m = itemRegex.exec(xml)) !== null) {
        const block = m[1];

        const getTag = (tag) => {
          const rx = new RegExp(
            `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'
          );
          const match = block.match(rx);
          return match ? (match[1] || match[2] || '').trim() : '';
        };

        const title       = getTag('title');
        const description = getTag('description');
        const pubDate     = getTag('pubDate');
        const sourceTag   = (block.match(/<source[^>]*>([^<]*)<\/source>/i) || [])[1] || '';

        const link = extractLink(block);
        if (!link || !title) continue;

        // Filtrar por keyword (insensible a tildes y mayúsculas)
        const isGoogleNews = url.includes('news.google.com');
        if (!isGoogleNews) {
          const combined = title + ' ' + description;
          if (!matchesKeyword(combined)) continue;
        }

        // Filtrar por fecha
        const { pubMs, dateStr } = parseDate(pubDate);
        if (pubMs !== null) {
          if (pubMs < cutoff)  continue;
          if (pubMs > ceiling) continue;
        }

        // Deduplicar — para Google News usar el dominio real si es un redirect
        let dedupeKey = link.replace(/^https?:\/\/(www\.)?/, '').split('?')[0];
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        // Nombre del medio
        let source = sourceTag;
        if (!source) {
          try {
            const host = new URL(link).hostname.replace('www.', '');
            // Si es un link de Google News, marcarlo como Google News
            source = link.includes('news.google.com') ? 'Google News' : host;
          } catch { source = 'Desconocido'; }
        }

        items.push({
          title: title.replace(/ [-–|] [^-–|]{1,30}$/, '').trim(),
          source,
          url: link,
          date: dateStr,
          excerpt: description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 280)
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

  // Deduplicación final
  const finalMentions = [];
  const seenFinal = new Set();
  for (const m of allMentions) {
    const key = m.url.replace(/^https?:\/\/(www\.)?/, '').split('?')[0];
    if (!seenFinal.has(key)) { seenFinal.add(key); finalMentions.push(m); }
  }

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
