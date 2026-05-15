module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const keyword  = (req.query && req.query.keyword)  || '';
  const fromDate = (req.query && req.query.from)      || '';
  const toDate   = (req.query && req.query.to)        || '';

  if (!keyword) return res.status(400).json({ error: 'Falta keyword' });

  const normalize = str => str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').trim();

  const kwNorm  = normalize(keyword);
  const kwWords = kwNorm.split(/\s+/).filter(w => w.length > 2);

  const matchesKeyword = (text) => {
    const textNorm = normalize(text);
    return kwWords.every(w => textNorm.includes(w));
  };

  const now     = Date.now();
  const cutoff  = fromDate ? new Date(fromDate).getTime() : now - 30 * 24 * 60 * 60 * 1000;
  const ceiling = toDate   ? new Date(toDate + 'T23:59:59').getTime() : now;

  const googleBase = `https://news.google.com/rss/search?hl=es&gl=ES&ceid=ES:es&q=`;
  const kwEncoded  = encodeURIComponent(keyword);
  const kwNormEnc  = encodeURIComponent(normalize(keyword));

  const rssUrls = [
    // ══ GOOGLE NEWS — variantes máxima cobertura ══
    googleBase + encodeURIComponent(`"${keyword}"`),
    googleBase + kwEncoded,
    googleBase + kwNormEnc,
    googleBase + encodeURIComponent(`${keyword} España`),
    googleBase + encodeURIComponent(`${keyword} Andalucía`),
    googleBase + encodeURIComponent(`${keyword} noticias`),
    googleBase + encodeURIComponent(`${keyword} España actualidad`),
    googleBase + encodeURIComponent(`${keyword} hoy`),

    // ══ AGENCIAS ══
    `https://www.europapress.es/rss/rss.aspx`,
    `https://www.europapress.es/andalucia/rss/rss.aspx`,
    `https://www.europapress.es/economia/rss/rss.aspx`,
    `https://www.europapress.es/nacional/rss/rss.aspx`,

    // ══ PRENSA NACIONAL ══
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
    `https://www.larazon.es/rss.xml`,
    `https://www.eldebate.com/rss.xml`,
    `https://www.vozpopuli.com/rss`,
    `https://www.elplural.com/rss`,
    `https://www.huffingtonpost.es/feeds/index.xml`,
    `https://theobjective.com/feed/`,
    `https://www.elconfidencialdigital.com/rss/portada.xml`,
    `https://diario16.com/feed/`,
    `https://www.elsaltodiario.com/feed`,
    `https://ctxt.es/rss`,

    // ══ PRENSA ECONÓMICA ══
    `https://www.expansion.com/rss/portada.xml`,
    `https://www.eleconomista.es/rss/rss-ultima-hora.php`,
    `https://cincodias.elpais.com/rss/cincodias/portada.xml`,
    `https://www.bolsamania.com/noticias/rss/`,

    // ══ DEPORTES (cubren actualidad general) ══
    `https://www.marca.com/rss/portada.xml`,
    `https://as.com/rss/tags/ultimas_noticias.xml`,
    `https://www.mundodeportivo.com/rss/portada.xml`,
    `https://www.sport.es/rss/portada.xml`,

    // ══ RADIO Y TV ══
    `https://www.cadenaser.com/rss/cadenaser.com/portada.xml`,
    `https://www.rtve.es/api/noticias.rss`,
    `https://www.cope.es/rss`,
    `https://www.ondacero.es/rss/`,
    `https://www.antena3.com/rss/noticias.xml`,
    `https://www.lasexta.com/rss/noticias.xml`,
    `https://www.telecinco.es/rss/noticias.xml`,

    // ══ ANDALUCÍA ══
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
    `https://www.abc.es/rss/feeds/abc_andalucia.xml`,
    `https://www.huelvabuenas.es/feed/`,
    `https://www.ideal.es/rss/portada.xml`,
    `https://www.sur.es/rss/portada.xml`,

    // ══ COMUNIDAD VALENCIANA ══
    `https://www.levante-emv.com/rss/portada.xml`,
    `https://www.informacion.es/rss/portada.xml`,
    `https://www.lasprovincias.es/rss/portada.xml`,
    `https://www.laverdad.es/rss/portada.xml`,

    // ══ CATALUÑA ══
    `https://www.elperiodico.com/es/rss/rss_portada.xml`,
    `https://www.elpuntavui.cat/rss.xml`,
    `https://www.elnacional.cat/feed/`,
    `https://www.vilaweb.cat/rss.xml`,
    `https://www.naciodigital.cat/rss.xml`,

    // ══ PAÍS VASCO / NAVARRA ══
    `https://www.diariovasco.com/rss/portada.xml`,
    `https://www.deia.eus/rss/portada.xml`,
    `https://www.noticiasdenavarra.com/rss/portada.xml`,
    `https://www.diariodenavarra.es/rss/portada.xml`,
    `https://www.noticiasdealava.eus/rss/portada.xml`,

    // ══ GALICIA ══
    `https://www.lavozdegalicia.es/rss/portada.xml`,
    `https://www.farodevigo.es/rss/portada.xml`,
    `https://www.elcorreogallego.es/rss.xml`,
    `https://www.atlantico.net/rss/portada.xml`,

    // ══ ASTURIAS ══
    `https://www.elcomercio.es/rss/portada.xml`,
    `https://www.lne.es/rss/portada.xml`,

    // ══ CANTABRIA ══
    `https://www.eldiariomontanes.es/rss/portada.xml`,

    // ══ CASTILLA Y LEÓN ══
    `https://www.elnortedecastilla.es/rss/portada.xml`,
    `https://www.diariodeburgos.es/rss/portada.xml`,
    `https://www.tribunasalamanca.com/rss`,

    // ══ ARAGÓN ══
    `https://www.heraldo.es/rss/portada.xml`,

    // ══ LA RIOJA ══
    `https://www.larioja.com/rss/portada.xml`,

    // ══ EXTREMADURA ══
    `https://www.hoy.es/rss/portada.xml`,
    `https://www.elperiodicoextremadura.com/rss/portada.xml`,

    // ══ CASTILLA-LA MANCHA ══
    `https://www.latribunadetoledo.es/feed/`,
    `https://www.lanzadigital.com/feed/`,

    // ══ MURCIA ══
    `https://www.laopiniondemurcia.es/rss/portada.xml`,

    // ══ CANARIAS ══
    `https://www.canarias7.es/rss/portada.xml`,
    `https://www.laprovincia.es/rss/portada.xml`,
    `https://www.eldia.es/rss/portada.xml`,
    `https://www.diariodeavisos.com/feed/`,
    `https://www.laopiniondetenerife.com/rss/portada.xml`,

    // ══ BALEARES ══
    `https://www.diariodemallorca.es/rss/portada.xml`,
    `https://ultimahora.es/rss/portada.xml`,
  ];

  // ──────────────────────────────────────────────
  // GDELT — base de datos global de noticias (gratuito)
  // ──────────────────────────────────────────────
  async function fetchGDELT() {
    try {
      const queries = [
        `"${keyword}" sourcelang:Spanish`,
        `${normalize(keyword)} sourcelang:Spanish sourcecountry:SP`,
      ];

      let timePart = '';
      if (fromDate && toDate) {
        const start = fromDate.replace(/-/g, '') + '000000';
        const end   = toDate.replace(/-/g, '')   + '235959';
        timePart = `&startdatetime=${start}&enddatetime=${end}`;
      } else {
        timePart = '&timespan=30d';
      }

      const allArticles = [];
      await Promise.allSettled(queries.map(async (q) => {
        const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&format=json&maxrecords=250&sort=DateDesc${timePart}`;
        const ctrl = new AbortController();
        const t    = setTimeout(() => ctrl.abort(), 9000);
        try {
          const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
          clearTimeout(t);
          if (!r.ok) return;
          const data = await r.json();
          if (!data.articles) return;
          for (const a of data.articles) {
            if (!a.url || !a.title) continue;
            // Parsear fecha: "20240115T120000Z"
            let dateStr = '';
            let pubMs   = null;
            if (a.seendate) {
              const sd = a.seendate;
              const y  = sd.slice(0,4), mo = sd.slice(4,6), d = sd.slice(6,8);
              const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`);
              if (!isNaN(dt.getTime())) {
                pubMs   = dt.getTime();
                dateStr = `${d}/${mo}/${y}`;
              }
            }
            if (pubMs !== null && (pubMs < cutoff || pubMs > ceiling)) continue;
            allArticles.push({
              title:   a.title.replace(/ [-–|] [^-–|]{1,30}$/, '').trim(),
              source:  a.domain || 'GDELT',
              url:     a.url,
              date:    dateStr,
              excerpt: ''
            });
          }
        } catch { clearTimeout(t); }
      }));
      return allArticles;
    } catch {
      return [];
    }
  }

  // ──────────────────────────────────────────────
  // Helpers RSS
  // ──────────────────────────────────────────────
  function parseDate(pubDate) {
    if (!pubDate) return { pubMs: null, dateStr: '' };
    try {
      const d = new Date(pubDate);
      if (isNaN(d.getTime())) return { pubMs: null, dateStr: '' };
      return {
        pubMs:   d.getTime(),
        dateStr: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
      };
    } catch { return { pubMs: null, dateStr: '' }; }
  }

  function extractLink(block) {
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
      const t    = setTimeout(() => ctrl.abort(), 7000);
      const r    = await fetch(url, {
        signal:  ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept':     'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      clearTimeout(t);
      if (!r.ok) return [];
      const xml = await r.text();
      if (!xml.includes('<item')) return [];

      const items     = [];
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
        const link        = extractLink(block);

        if (!link || !title) continue;

        const isGoogleNews = url.includes('news.google.com');
        if (!isGoogleNews && !matchesKeyword(title + ' ' + description)) continue;

        const { pubMs, dateStr } = parseDate(pubDate);
        if (pubMs !== null && (pubMs < cutoff || pubMs > ceiling)) continue;

        let source = sourceTag;
        if (!source) {
          try {
            const host = new URL(link).hostname.replace('www.', '');
            source = link.includes('news.google.com') ? 'Google News' : host;
          } catch { source = 'Desconocido'; }
        }

        items.push({
          title:   title.replace(/ [-–|] [^-–|]{1,30}$/, '').trim(),
          source,
          url:     link,
          date:    dateStr,
          excerpt: description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 280)
        });
      }
      return items;
    } catch {
      return [];
    }
  }

  // ──────────────────────────────────────────────
  // Lanzar TODO en paralelo: RSS + GDELT
  // ──────────────────────────────────────────────
  const [rssResults, gdeltArticles] = await Promise.all([
    Promise.allSettled(rssUrls.map(fetchRSS)),
    fetchGDELT()
  ]);

  const allMentions = [];
  for (const r of rssResults) {
    if (r.status === 'fulfilled') allMentions.push(...r.value);
  }
  allMentions.push(...gdeltArticles);

  // Deduplicación final por URL
  const finalMentions = [];
  const seenFinal     = new Set();
  for (const m of allMentions) {
    if (!m.url) continue;
    const key = m.url.replace(/^https?:\/\/(www\.)?/, '').split('?')[0];
    if (!seenFinal.has(key)) { seenFinal.add(key); finalMentions.push(m); }
  }

  // Ordenar por fecha descendente
  finalMentions.sort((a, b) => {
    const parse = d => {
      if (!d) return 0;
      const [dd, mm, yy] = d.split('/');
      return new Date(yy, mm - 1, dd).getTime();
    };
    return parse(b.date) - parse(a.date);
  });

  const sourceMap = {};
  for (const m of finalMentions) sourceMap[m.source] = (sourceMap[m.source] || 0) + 1;
  const sources_summary = Object.entries(sourceMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return res.status(200).json({
    total:    finalMentions.length,
    mentions: finalMentions,
    sources:  sources_summary
  });
};
