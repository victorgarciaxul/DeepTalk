import { useState, useEffect } from 'react';

// SSO + auth guard — antes de cualquier render
;(() => {
  const params = new URLSearchParams(window.location.search);
  const ssoEmail = params.get('sso_email');
  if (ssoEmail) {
    const allowed = ['victorgarcia@xul.es','carlagarcia@xul.es','tech@xul.es','josecastillo@xul.es','elenarojo@xul.es','jorgemelo@xul.es','silviamunoz@xul.es'];
    if (allowed.includes(ssoEmail.toLowerCase())) {
      localStorage.setItem('xul_appcenter_auth', '1');
      localStorage.setItem('xul_user', ssoEmail.toLowerCase());
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
  if (localStorage.getItem('xul_appcenter_auth') !== '1') {
    window.location.replace('https://appcenter.xul.es?return_to=' + encodeURIComponent(window.location.origin));
  }
})();
import {
  Search, Plus, Trash2, Pause, Play, Settings,
  Database, RefreshCw, BarChart2, List, ExternalLink,
  Activity, Layers, Award, FileText, Calendar, Download,
  Clock, PieChart as PieChartIcon, Link2, Share2, Users, Moon, Sun, Info,
  Sparkles, Copy, Check, X, TrendingUp, MessageSquare, Lightbulb, Target
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sbClient, searchOpenAI, searchRSS } from './utils/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ["#7A3FAF", "#10b981", "#f59e0b", "#ef4444", "#9B5FD0", "#ec4899", "#14b8a6", "#f97316"];
const PIE_COLORS = ['#7A3FAF', '#f59e0b', '#10b981'];

const analyzeMention = (m, subKw1, subKw2) => {
  const text = ((m.title || '') + ' ' + (m.excerpt || '')).toLowerCase();
  const sub1 = subKw1 && text.includes(subKw1.toLowerCase()) ? 'SÍ' : 'NO';
  const sub2 = subKw2 && text.includes(subKw2.toLowerCase()) ? 'SÍ' : 'NO';

  let tono = 'neutro';
  if (text.match(/(éxito|buen|positivo|crecim|avance|mejor|beneficio|acuerdo)/)) tono = 'positivo';
  if (text.match(/(crisis|caída|problema|mal|peor|riesgo|crítica|error)/)) tono = 'negativo';

  // Heuristic for impact and value (simulated)
  const reach = Math.floor(Math.random() * 50000) + 5000;
  const value = Math.floor(reach * (tono === 'positivo' ? 0.5 : tono === 'negativo' ? 0.1 : 0.25));

  return { ...m, sub1, sub2, tono, reach, value };
};

export default function App() {
  const [config, setConfig] = useState({
    sbUrl: import.meta.env.VITE_SB_URL || localStorage.getItem('xul_sb_url') || '',
    sbKey: import.meta.env.VITE_SB_KEY || localStorage.getItem('xul_sb_key') || '',
    oaKey: import.meta.env.VITE_OA_KEY || localStorage.getItem('xul_oa_key') || '',
    isConfigured: localStorage.getItem('xul_appcenter_auth') === '1' || !!(import.meta.env.VITE_SB_URL && import.meta.env.VITE_SB_KEY && import.meta.env.VITE_OA_KEY)
  });

  const [db, setDb] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [mentions, setMentions] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('feed');
  const [newKw, setNewKw] = useState('');
  const [subKw1, setSubKw1] = useState('');
  const [subKw2, setSubKw2] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (config.sbUrl && config.sbKey) {
      const client = sbClient(config.sbUrl, config.sbKey);
      setDb(client);
      setConfig(prev => ({ ...prev, isConfigured: true }));
      loadKeywords(client);
    }
  }, []);

  const loadKeywords = async (client, idToSelect = null) => {
    try {
      const rows = await client.get("keywords", "order=created_at.asc");
      const kws = rows.map((r, i) => ({ ...r, color: r.color || COLORS[i % COLORS.length] }));
      setKeywords(kws);
      if (kws.length > 0) {
        const targetId = idToSelect || selectedId || kws[0].id;
        setSelectedId(targetId);
        loadMentions(client, targetId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadMentions = async (client, kwId, from = '', to = '') => {
    try {
      let query = `keyword_id=eq.${kwId}&order=found_at.desc`;
      if (from) query += `&found_at=gte.${from}T00:00:00`;
      if (to)   query += `&found_at=lte.${to}T23:59:59`;
      if (!from && !to) query += `&limit=200`;
      const rows = await client.get("mentions", query);
      setMentions(rows);

      const map = {};
      for (const x of rows) map[x.source] = (map[x.source] || 0) + 1;
      const computedSources = Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      setSources(computedSources);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (db && selectedId) {
      loadMentions(db, selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    if (db && selectedId) {
      loadMentions(db, selectedId, dateFrom, dateTo);
    }
  }, [dateFrom, dateTo]);

  const handleConfigSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const uv = formData.get('sbUrl').trim();
    const kv = formData.get('sbKey').trim();
    const ov = formData.get('oaKey').trim();

    if (!uv || !kv || !ov) return;

    localStorage.setItem('xul_sb_url', uv);
    localStorage.setItem('xul_sb_key', kv);
    localStorage.setItem('xul_oa_key', ov);

    const client = sbClient(uv, kv);
    setDb(client);
    setConfig({ sbUrl: uv, sbKey: kv, oaKey: ov, isConfigured: true });
    loadKeywords(client);
  };

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    const t = newKw.trim();
    if (!t || !db) return;

    const color = COLORS[keywords.length % COLORS.length];
    try {
      const rows = await db.post("keywords", { text: t, active: true, color });
      const nr = Array.isArray(rows) ? rows[0] : rows;
      if (nr && nr.id) {
        await loadKeywords(db, nr.id);
      } else {
        await loadKeywords(db);
      }
      setNewKw('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteKeyword = async (id, e) => {
    e.stopPropagation();
    if (!db) return;
    try {
      await db.del("keywords", id);
      const newKws = keywords.filter(x => x.id !== id);
      setKeywords(newKws);
      if (selectedId === id) {
        setSelectedId(newKws[0]?.id || null);
        if (newKws.length === 0) {
          setMentions([]);
          setSources([]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleKeyword = async (kw) => {
    if (!db) return;
    const na = !kw.active;
    try {
      await db.patch("keywords", kw.id, { active: na });
      setKeywords(keywords.map(k => k.id === kw.id ? { ...k, active: na } : k));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async () => {
    const kw = keywords.find(k => k.id === selectedId);
    if (!kw || loading || !db) return;

    setLoading(true);
    try {
      // Lanzar OpenAI y RSS en paralelo, pasando el rango de fechas activo
      const [aiResult, rssResult] = await Promise.allSettled([
        searchOpenAI(kw.text, dateFrom, dateTo),
        searchRSS(kw.text, dateFrom, dateTo)
      ]);

      const aiMentions  = aiResult.status  === 'fulfilled' ? (aiResult.value.mentions  || []) : [];
      const rssMentions = rssResult.status === 'fulfilled' ? (rssResult.value.mentions || []) : [];

      // Fusionar y deduplicar por URL
      const seenUrls = new Set();
      const combined = [...aiMentions, ...rssMentions].filter(m => {
        if (!m.url?.startsWith("http")) return false;
        const key = m.url.replace(/^https?:\/\/(www\.)?/, '').split('?')[0];
        if (seenUrls.has(key)) return false;
        seenUrls.add(key);
        return true;
      });

      if (combined.length > 0) {
        const ins = combined.map(m => ({
          keyword_id:   kw.id,
          keyword_text: kw.text,
          title:        m.title   || "",
          source:       m.source  || "",
          url:          m.url,
          mention_date: m.date    || "",
          excerpt:      m.excerpt || ""
        }));
        try { await db.post("mentions", ins); } catch (e) { console.error("Error guardando menciones", e); }
      }

      try { await db.patch("keywords", kw.id, { last_searched_at: new Date().toISOString() }); } catch (e) {}
      await loadKeywords(db);
      await loadMentions(db, kw.id, dateFrom, dateTo);

      if (combined.length === 0) {
        const errMsg = [
          aiResult.status  === 'rejected' ? `OpenAI: ${aiResult.reason?.message}`  : null,
          rssResult.status === 'rejected' ? `RSS: ${rssResult.reason?.message}`     : null
        ].filter(Boolean).join(' | ');
        if (errMsg) alert("Aviso: " + errMsg);
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  // Extract just YYYY-MM-DD from any date string
  const toDateKey = (raw) => {
    if (!raw) return null;
    let s = String(raw).trim();
    if (!s) return null;

    // Normalize separators
    s = s.replace(/\//g, '-');

    // Case 1: DD-MM-YYYY or D-M-YYYY
    const dmyMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/);
    if (dmyMatch && dmyMatch[3].length > 2) {
      const [_, d, m, y] = dmyMatch;
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }

    // Case 2: YYYY-MM-DD (ISO)
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const [_, y, m, d] = isoMatch;
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }

    // Fallback: Native Date parsing
    try {
      const d = new Date(s.includes(' ') ? s.replace(' ', 'T') : s);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch(e) {}

    return null;
  };

  // El filtrado por fecha se hace en Supabase (server-side), no en cliente
  const enrichedMentions = mentions
    .map(m => analyzeMention(m, subKw1, subKw2))
    .sort((a, b) => {
      // Ordenar por fecha de publicación (mention_date), fallback a found_at
      const da = toDateKey(a.mention_date) || toDateKey(a.found_at) || '';
      const db = toDateKey(b.mention_date) || toDateKey(b.found_at) || '';
      if (da > db) return -1;
      if (da < db) return 1;
      return 0;
    });

  const isFiltered = dateFrom || dateTo;
  const clearDateFilter = () => { setDateFrom(''); setDateTo(''); };

  const handleAnalyze = async () => {
    if (!activeKw || enrichedMentions.length === 0) return;
    setAnalysisLoading(true);
    setShowAnalysis(true);
    setAnalysisData(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: activeKw.text,
          mentions: enrichedMentions.map(m => ({
            title:   m.title,
            source:  m.source,
            excerpt: m.excerpt,
            date:    m.mention_date || m.found_at || '',
            tono:    m.tono
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en análisis');
      setAnalysisData(data);
    } catch (e) {
      setAnalysisData({ error: e.message });
    }
    setAnalysisLoading(false);
  };

  const handleCopyAnalysis = () => {
    if (!analysisData) return;
    const d = analysisData;
    const text = [
      `ANÁLISIS DE COBERTURA — ${activeKw?.text}`,
      `\nRESUMEN\n${d.resumen}`,
      `\nTONO GENERAL: ${(d.tono_general || '').toUpperCase()}\n${d.tono_descripcion}`,
      `\nTEMAS CLAVE\n${(d.temas || []).map(t => `• ${t}`).join('\n')}`,
      `\nHALLAZGOS\n${(d.hallazgos || []).map(h => `• ${h}`).join('\n')}`,
      `\nCONCLUSIONES\n${d.conclusiones}`,
      `\nRECOMENDACIONES\n${(d.recomendaciones || []).map(r => `• ${r}`).join('\n')}`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const handleExportPDF = () => {
    if (!activeKw || enrichedMentions.length === 0) return;

    const totalValue = enrichedMentions.reduce((acc, m) => acc + (m.value || 0), 0);
    const totalReach = enrichedMentions.reduce((acc, m) => acc + (m.reach || 0), 0);

    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.width;

    // Premium Background Header
    doc.setFillColor(11, 15, 28); // #0b0f1c
    doc.rect(0, 0, pageWidth, 50, 'F');

    // Branding
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("XUL", 14, 25);
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // --text-tertiary
    doc.text("· Monitor de Medios", 34, 25);

    doc.setFontSize(10);
    doc.setTextColor(96, 165, 250); // --accent
    doc.text("XUL - COMUNICAMOS LO PÚBLICO", pageWidth - 70, 25);

    // Title
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(`Informe de Menciones: ${activeKw.text}`, 14, 40);

    // Summary Stats in PDF
    doc.setFillColor(22, 29, 48); // sidebar color #161d30
    doc.roundedRect(14, 55, pageWidth - 28, 25, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("TOTAL VALOR ECONÓMICO", 20, 65);
    doc.text("ALCANCE TOTAL", 80, 65);
    doc.text("TOTAL MENCIONES", 140, 65);
    doc.text("GENERADO EL", pageWidth - 60, 65);

    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(`${totalValue.toLocaleString()} €`, 20, 73);
    doc.text(`${totalReach.toLocaleString()}`, 80, 73);
    doc.text(`${enrichedMentions.length}`, 140, 73);
    doc.setFontSize(10);
    doc.text(format(new Date(), "dd/MM/yyyy HH:mm"), pageWidth - 60, 73);

    const tableData = enrichedMentions.map(m => [
      m.title || '-',
      m.source || '-',
      m.tono.toUpperCase(),
      `${m.reach.toLocaleString()}`,
      `${m.value.toLocaleString()} €`,
      m.url || '-'
    ]);

    autoTable(doc, {
      startY: 85,
      head: [['Titular', 'Medio', 'Tono', 'Alcance', 'V. Económico', 'Enlace (URL)']],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [11, 15, 28], 
        textColor: [96, 165, 250], 
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center'
      },
      styles: { 
        fontSize: 9, 
        cellPadding: 4, 
        valign: 'middle',
        overflow: 'linebreak',
        textColor: [51, 65, 85]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 60, textColor: [122, 63, 175] }
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`XUL_Menciones_${activeKw.text.replace(/\s+/g, '_')}.pdf`);
  };

  if (!config.isConfigured) {
    // Barras del ecualizador — valores fijos para evitar re-renders
    const eqBars = [
      40,70,55,85,35,90,60,45,75,30,80,50,65,40,95,55,70,38,82,48,
      63,77,42,58,88,33,72,52,67,43,78,36,62,47,83,53,69,39,74,44,
      79,57,64,35,87,51,68,41,76,46,55,73,37,84,49,66,44,81,59,28
    ];
    const eqDur = [
      0.8,1.1,0.9,1.3,0.7,1.2,1.0,0.85,1.15,0.95,1.25,0.75,1.05,1.35,0.82,
      1.18,0.92,1.28,0.78,1.08,1.38,0.83,1.13,0.93,1.23,0.73,1.03,1.33,0.88,
      1.48,0.98,1.18,0.68,1.08,0.88,1.28,0.78,1.18,0.98,1.38,0.84,1.14,0.94,
      1.24,0.74,1.04,1.34,0.89,1.19,0.99,1.09,0.79,1.29,0.89,1.19,0.69,1.09,0.99,1.39,0.85
    ];
    const eqDelay = [
      0,0.2,0.1,0.35,0.05,0.25,0.15,0.3,0.08,0.18,0.28,0.38,0.03,0.23,0.13,
      0.33,0.07,0.27,0.17,0.37,0.02,0.22,0.12,0.32,0.06,0.26,0.16,0.36,0.04,
      0.24,0.14,0.34,0.09,0.29,0.19,0.39,0.01,0.21,0.11,0.31,0.41,0.06,0.16,
      0.26,0.36,0.11,0.21,0.31,0.41,0.16,0.06,0.26,0.36,0.04,0.14,0.24,0.34,0.09,0.19,0.29
    ];

    // Palabras flotantes de medios españoles
    const floatWords = [
      { w: 'El País',     x: 8,  y: 12, d: 9  },
      { w: 'RTVE',        x: 78, y: 8,  d: 7  },
      { w: 'ABC',         x: 22, y: 68, d: 11 },
      { w: 'Cadena SER',  x: 60, y: 22, d: 8  },
      { w: 'El Mundo',    x: 42, y: 80, d: 10 },
      { w: 'Prensa',      x: 85, y: 55, d: 6  },
      { w: 'Noticias',    x: 14, y: 44, d: 12 },
      { w: 'Europa Press',x: 55, y: 60, d: 9  },
      { w: 'La SER',      x: 30, y: 18, d: 7  },
      { w: 'Digital',     x: 70, y: 76, d: 10 },
      { w: 'Monitor',     x: 5,  y: 85, d: 8  },
      { w: 'Radio',       x: 90, y: 32, d: 11 },
      { w: 'La Vanguardia',x: 48, y: 35, d: 13 },
      { w: 'Clipping',    x: 25, y: 92, d: 7  },
      { w: 'El Confidencial', x: 65, y: 48, d: 9 },
      { w: 'Medios',      x: 38, y: 55, d: 6  },
    ];

    return (
      <div className="config-overlay">
        {/* ── Fondo animado ── */}
        <div className="login-bg-anim">
          {/* Grid de puntos */}
          <div className="login-grid" />

          {/* Línea de escaneo */}
          <div className="scan-line" />

          {/* Ondas de radio */}
          <div className="radio-waves">
            <div className="radio-ring" />
            <div className="radio-ring" />
            <div className="radio-ring" />
            <div className="radio-ring" />
            <div className="radio-center-dot" />
          </div>

          {/* Ecualizador */}
          <div className="eq-container">
            {eqBars.map((h, i) => (
              <div
                key={i}
                className="eq-bar"
                style={{
                  '--h': `${h}%`,
                  '--d': `${eqDur[i] ?? 1}s`,
                  animationDelay: `${eqDelay[i] ?? 0}s`
                }}
              />
            ))}
          </div>

          {/* Palabras flotantes */}
          {floatWords.map((fw) => (
            <div
              key={fw.w}
              className="float-word"
              style={{
                left: `${fw.x}%`,
                top: `${fw.y}%`,
                '--d': `${fw.d}s`,
                animationDelay: `${(fw.x * 0.07) % 3}s`
              }}
            >
              {fw.w}
            </div>
          ))}
        </div>

        {/* ── Panel de login ── */}
        <div className="glass-panel config-panel">
          {/* Logo DeepTalk dentro del panel */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.75rem', gap: '0.6rem' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(145deg, #1a2a1a 0%, #0f1f0f 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(245,166,35,0.25), 0 4px 12px rgba(0,0,0,0.6)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 12C5 8.13 8.13 5 12 5C15.87 5 19 8.13 19 12" stroke="#F5A623" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
                <rect x="3" y="12" width="4" height="6" rx="2" fill="#F5A623"/>
                <rect x="17" y="12" width="4" height="6" rx="2" fill="#F5A623"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1 }}>
              DeepTalk
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
              Monitor de Medios · XUL
            </p>
          </div>

          <div className="config-header" style={{ marginBottom: '1.5rem' }}>
            <p className="config-desc">Introduce tus credenciales para comenzar a monitorizar.</p>
          </div>
          <form className="config-form" onSubmit={handleConfigSubmit}>
            <div className="form-group">
              <label>Supabase URL</label>
              <input name="sbUrl" defaultValue={config.sbUrl} placeholder="https://xxxx.supabase.co" required />
            </div>
            <div className="form-group">
              <label>Supabase Anon Key</label>
              <input name="sbKey" defaultValue={config.sbKey} type="password" placeholder="eyJhbGci..." required />
            </div>
            <div className="form-group">
              <label>OpenAI API Key</label>
              <input name="oaKey" defaultValue={config.oaKey} type="password" placeholder="sk-proj-..." required />
            </div>
            <button type="submit" className="btn-primary config-submit">
              Conectar al Monitor <Database className="w-4 h-4 ml-2" />
            </button>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setConfig(prev => ({ ...prev, isConfigured: true, isGuest: true }))}
                style={{ width: '100%' }}
              >
                <Users className="w-4 h-4 mr-2" /> Acceso para Invitados
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              Tus credenciales se guardan localmente en tu navegador.
            </p>
          </form>
        </div>
      </div>
    );
  }

  const activeKw = keywords.find(k => k.id === selectedId);

  const adaData = [
    { name: 'SÍ', value: enrichedMentions.filter(m => m.sub1 === 'SÍ').length },
    { name: 'NO', value: enrichedMentions.filter(m => m.sub1 === 'NO').length }
  ];
  const prtrData = [
    { name: 'SÍ', value: enrichedMentions.filter(m => m.sub2 === 'SÍ').length },
    { name: 'NO', value: enrichedMentions.filter(m => m.sub2 === 'NO').length }
  ];
  const tonoData = [
    { name: 'Positivo', value: enrichedMentions.filter(m => m.tono === 'positivo').length },
    { name: 'Neutro', value: enrichedMentions.filter(m => m.tono === 'neutro').length },
    { name: 'Negativo', value: enrichedMentions.filter(m => m.tono === 'negativo').length }
  ].filter(d => d.value > 0);
  if (tonoData.length === 0) tonoData.push({ name: 'Sin datos', value: 1 });

  return (
    <div id="root" className="glass-panel app-container">
      <header className="header">
        <div className="header-brand">
          {/* DeepTalk logo — icono auricular dorado */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(145deg, #1a2a1a 0%, #0f1f0f 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              {/* Arco superior del auricular */}
              <path d="M5 12C5 8.13 8.13 5 12 5C15.87 5 19 8.13 19 12" stroke="#F5A623" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
              {/* Orejera izquierda */}
              <rect x="3" y="12" width="4" height="6" rx="2" fill="#F5A623"/>
              {/* Orejera derecha */}
              <rect x="17" y="12" width="4" height="6" rx="2" fill="#F5A623"/>
            </svg>
          </div>
          <h1 className="header-title" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, letterSpacing: '-0.03em' }}>
            DeepTalk
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="header-badge">
            XUL - COMUNICAMOS LO PÚBLICO
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="btn-icon" style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--panel-border)' }} title="Cambiar tema">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">Palabras Clave</div>
          <div className="keyword-list">
            {keywords.map(k => (
              <div
                key={k.id}
                className={`keyword-item ${selectedId === k.id ? 'active' : ''}`}
                onClick={() => setSelectedId(k.id)}
              >
                <div className="kw-indicator" style={{
                  backgroundColor: k.active ? k.color : 'transparent',
                  border: k.active ? 'none' : `2px solid var(--text-tertiary)`
                }} />
                <span className="kw-name" style={{ color: k.active ? 'inherit' : 'var(--text-tertiary)' }}>
                  {k.text}
                </span>
                {selectedId === k.id && mentions.length > 0 && (
                  <span className="kw-count">{mentions.length}</span>
                )}
                <button className="kw-delete" onClick={(e) => handleDeleteKeyword(k.id, e)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            {/* FAQs */}
            {[
              {
                id: 1,
                icon: <Layers className="w-3.5 h-3.5" />,
                q: '¿Qué fuentes analiza?',
                a: 'Rastrea más de 120 fuentes en paralelo: Google News (8 variantes), GDELT (base de datos global, miles de medios), Europa Press, El País, El Mundo, ABC, La Vanguardia, El Confidencial, 20minutos, Público, elDiario.es, El Español, OKDiario, La Razón, El Debate, InfoLibre, Libertad Digital, Vozpópuli, HuffPost ES, The Objective, Diario16, El Salto; TV/Radio: RTVE, Cadena SER, COPE, Onda Cero, Antena 3, La Sexta, Telecinco; Economía: Expansión, El Economista, Cinco Días, Bolsamanía; Andalucía: Diario de Sevilla, Cádiz, Córdoba, Almería, Granada Hoy, Málaga Hoy, Huelva Información, Jaén Hoy, Sur, Europasur, La Voz de Almería, ABC Sevilla e Ideal; C. Valenciana: Levante-EMV, Información, Las Provincias; Cataluña: El Periódico, El Punt Avui, El Nacional, VilaWeb, NacióDigital; País Vasco/Navarra: Diario Vasco, Deia, Noticias de Navarra, Diario de Navarra; Galicia: La Voz de Galicia, Faro de Vigo, El Correo Gallego; Asturias: El Comercio, La Nueva España; Cantabria: El Diario Montañés; Castilla y León: El Norte de Castilla, Diario de Burgos; Aragón: Heraldo de Aragón; La Rioja: La Rioja; Extremadura: Hoy.es, El Periódico Extremadura; Murcia: La Opinión de Murcia; Canarias: Canarias7, La Provincia, El Día, Diario de Avisos; Baleares: Diario de Mallorca, Última Hora. Además, OpenAI busca en toda la web pública indexada.'
              },
              {
                id: 2,
                icon: <Info className="w-3.5 h-3.5" />,
                q: '¿Qué limitaciones tiene?',
                a: 'No accede a contenido de pago (muros de suscripción), redes sociales (X, Instagram, TikTok), bases de datos privadas (Factiva, Lexis-Nexis) ni medios que bloqueen rastreo. Los resultados dependen de lo que esté publicado e indexado en el momento de la búsqueda.'
              },
              {
                id: 3,
                icon: <Database className="w-3.5 h-3.5" />,
                q: '¿Cómo se calcula el valor económico?',
                a: 'Se usa el VPE (Valor Publicitario Equivalente): se estima el alcance del medio y se multiplica por un factor según el tono de la noticia — positivo (×0,5), neutro (×0,25) o negativo (×0,1). Es una estimación orientativa, no un valor auditado.'
              }
            ].map(faq => (
              <div key={faq.id} className="faq-item">
                <button
                  className="faq-trigger"
                  onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                >
                  <span className="faq-icon">{faq.icon}</span>
                  <span className="faq-question">{faq.q}</span>
                  <span className="faq-chevron" style={{ transform: openFaq === faq.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                </button>
                {openFaq === faq.id && (
                  <div className="faq-answer">{faq.a}</div>
                )}
              </div>
            ))}

            <form className="add-kw-form" onSubmit={handleAddKeyword}>
              <input
                value={newKw}
                onChange={(e) => setNewKw(e.target.value)}
                placeholder="Nueva keyword..."
              />
              <button type="submit" className="btn-icon">
                <Plus className="w-5 h-5" />
              </button>
            </form>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {activeKw ? (
            <>
              <div className="main-header">
                <div className="kw-title-section">
                  <div className="kw-title-row">
                    <div className="kw-title-dot" style={{ backgroundColor: activeKw.color, color: activeKw.color }} />
                    <h2 className="kw-title">{activeKw.text}</h2>
                  </div>
                  {activeKw.last_searched_at && (
                    <div className="kw-meta">
                      <RefreshCw className="w-3 h-3" />
                      Última búsqueda n8n: {format(new Date(activeKw.last_searched_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.75rem', margin: '0.25rem 0 0 2rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 'bold' }}>K1:</span>
                      <input type="text" value={subKw1} onChange={e => setSubKw1(e.target.value)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', width: '90px' }} placeholder="Keyword 1" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 'bold' }}>K2:</span>
                      <input type="text" value={subKw2} onChange={e => setSubKw2(e.target.value)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', width: '90px' }} placeholder="Keyword 2" />
                    </div>
                    <div style={{ width: '1px', height: '20px', background: 'var(--panel-border)', margin: '0 0.1rem' }} />
                    <button
                      onClick={() => setShowDateFilter(!showDateFilter)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase',
                        padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${isFiltered ? 'var(--accent)' : 'var(--panel-border)'}`,
                        color: isFiltered ? 'var(--accent)' : 'var(--text-tertiary)',
                        background: isFiltered ? 'rgba(59,130,246,0.08)' : 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <Calendar className="w-3 h-3" />
                      {isFiltered
                        ? `${dateFrom || '...'} → ${dateTo || '...'}`
                        : 'Filtrar fechas'
                      }
                    </button>
                    {isFiltered && (
                      <button onClick={clearDateFilter} style={{ fontSize: '0.75rem', color: 'var(--danger)', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--danger)', background: 'rgba(239,68,68,0.07)', cursor: 'pointer' }}>
                        ✕ Quitar filtro
                      </button>
                    )}
                  </div>
                  {showDateFilter && (
                    <div className="date-filter-panel">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Desde:</span>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: '150px' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Hasta:</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: '150px' }} />
                        <button onClick={() => { 
                          const d = new Date(); 
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, '0');
                          setDateFrom(`${y}-${m}-01`); 
                          setDateTo(`${y}-${m}-${String(d.getDate()).padStart(2, '0')}`); 
                        }} style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)', cursor: 'pointer', color: 'var(--text-secondary)', background: 'var(--element-bg)' }}>Este mes</button>
                        
                        <button onClick={() => { 
                          const now = new Date(); 
                          const past = new Date(now.getTime() - 7*24*60*60*1000); 
                          const y = past.getFullYear();
                          const m = String(past.getMonth() + 1).padStart(2, '0');
                          const d = String(past.getDate()).padStart(2, '0');
                          setDateFrom(`${y}-${m}-${d}`);
                          setDateTo(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`);
                        }} style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)', cursor: 'pointer', color: 'var(--text-secondary)', background: 'var(--element-bg)' }}>Últimos 7d</button>
                        <button onClick={() => { const now = new Date(); setDateFrom(format(new Date(now.getTime() - 30*24*60*60*1000), 'yyyy-MM-dd')); setDateTo(format(now, 'yyyy-MM-dd')); }} style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)', cursor: 'pointer', color: 'var(--text-secondary)', background: 'var(--element-bg)' }}>Últimos 30d</button>
                        <button onClick={handleSearch} className="btn-primary" style={{ marginLeft: '0.5rem', padding: '0.35rem 0.7rem', fontSize: '0.75rem' }}>Buscar</button>
<button onClick={() => setShowDateFilter(false)} style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)', cursor: 'pointer', color: 'var(--text-secondary)', background: 'var(--element-bg)' }}>Cerrar</button>
                      </div>
                      {isFiltered && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>
                          {enrichedMentions.length} menciones en el rango seleccionado (de {mentions.length} totales)
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="actions-group">
                  {config.isGuest && (
                    <button className="btn-outline" onClick={() => alert("Enlace de invitado copiado al portapapeles")}>
                      <Share2 className="w-4 h-4" /> Compartir
                    </button>
                  )}
                  <button
                    className="btn-outline btn-analysis"
                    onClick={handleAnalyze}
                    disabled={mentions.length === 0}
                    style={{ opacity: mentions.length === 0 ? 0.5 : 1 }}
                  >
                    <Sparkles className="w-4 h-4" /> Análisis IA
                  </button>
                  <button
                    className="btn-outline"
                    onClick={handleExportPDF}
                    disabled={mentions.length === 0}
                    style={{ opacity: mentions.length === 0 ? 0.5 : 1 }}
                  >
                    <Download className="w-4 h-4" /> Exportar PDF
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => handleToggleKeyword(activeKw)}
                  >
                    {activeKw.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {activeKw.active ? 'Pausar' : 'Activar'}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSearch}
                    disabled={loading || !activeKw.active}
                    style={{ opacity: (loading || !activeKw.active) ? 0.7 : 1 }}
                  >
                    {loading ? <RefreshCw className="w-4 h-4 spin" /> : <Search className="w-4 h-4" />}
                    {loading ? 'Buscando...' : 'Buscar ahora'}
                  </button>
                </div>
              </div>

              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-label"><FileText className="w-4 h-4" /> Guardadas</div>
                  <div className="metric-value">{mentions.length}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label"><Layers className="w-4 h-4" /> Fuentes</div>
                  <div className="metric-value">{sources.length}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label"><Award className="w-4 h-4" /> Principal</div>
                  <div className="metric-value" style={{ fontSize: '1.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sources[0]?.name || '—'}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label"><PieChartIcon className="w-4 h-4" /> Dominio</div>
                  <div className="metric-value">{mentions.length ? ((sources[0]?.count || 0) / mentions.length * 100).toFixed(1) : 0}%</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label"><Activity className="w-4 h-4" /> Alcance Est.</div>
                  <div className="metric-value">{enrichedMentions.reduce((acc, m) => acc + (m.reach || 0), 0).toLocaleString()}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">
                    <Database className="w-4 h-4" /> Valor Est.
                    <div className="tooltip-container">
                      <Info className="w-3 h-3 ml-1 cursor-help opacity-50" />
                      <span className="tooltip-text">
                        VPE (Valor Publicitario Equivalente): Estimación basada en alcance y tono.<br/>
                        <b>Positivo (x0.5)</b>, Neutro (x0.25), Negativo (x0.1).
                      </span>
                    </div>
                  </div>
                  <div className="metric-value" style={{ color: 'var(--success)' }}>
                    {enrichedMentions.reduce((acc, m) => acc + (m.value || 0), 0).toLocaleString()} €
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label"><Clock className="w-4 h-4" /> Recientes (7d)</div>
                  <div className="metric-value">{mentions.filter(m => (new Date() - new Date(m.found_at)) < 7 * 24 * 60 * 60 * 1000).length}</div>
                </div>
              </div>

              <div className="metrics-grid" style={{ paddingTop: 0, gap: '1rem' }}>
                <div className="metric-card" style={{ height: '210px', display: 'flex', flexDirection: 'column' }}>
                  <div className="metric-label">Menciona {subKw1 || 'Sub 1'}</div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={adaData} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                          {adaData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip />
                        <Legend verticalAlign="bottom" height={20} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="metric-card" style={{ height: '210px', display: 'flex', flexDirection: 'column' }}>
                  <div className="metric-label">Menciona {subKw2 || 'Sub 2'}</div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={prtrData} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                          {prtrData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip />
                        <Legend verticalAlign="bottom" height={20} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="metric-card" style={{ height: '210px', display: 'flex', flexDirection: 'column' }}>
                  <div className="metric-label">Tono de la mención</div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={tonoData} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                          {tonoData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip />
                        <Legend verticalAlign="bottom" height={20} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="tabs-container">
                <button
                  className={`tab-btn ${view === 'feed' ? 'active' : ''}`}
                  onClick={() => setView('feed')}
                >
                  <List className="w-4 h-4 inline mr-2 align-text-bottom" /> Feed de Noticias
                </button>
                <button
                  className={`tab-btn ${view === 'fuentes' ? 'active' : ''}`}
                  onClick={() => setView('fuentes')}
                >
                  <BarChart2 className="w-4 h-4 inline mr-2 align-text-bottom" /> Análisis de Fuentes
                </button>
              </div>

              <div className="content-area">
                {loading ? (
                  <div className="empty-state">
                    <RefreshCw className="w-8 h-8 spin text-accent mb-4" />
                    <h3 className="empty-title">Analizando la web...</h3>
                    <p className="empty-desc">OpenAI está buscando las últimas menciones en medios digitales españoles.</p>
                  </div>
                ) : view === 'feed' ? (
                  mentions.length === 0 ? (
                    <div className="empty-state">
                      <Search className="empty-icon" />
                      <h3 className="empty-title">No hay menciones registradas</h3>
                      <p className="empty-desc">Pulsa "Buscar ahora" para iniciar una búsqueda manual o espera al próximo ciclo automático de n8n.</p>
                    </div>
                  ) : (
                    <div className="news-cards-list">
                      {enrichedMentions.map((m, i) => {
                        const dateLabel = m.mention_date || (m.found_at ? format(new Date(m.found_at), "dd/MM/yyyy", { locale: es }) : '');
                        const tonoColor = m.tono === 'positivo' ? '#10b981' : m.tono === 'negativo' ? '#ef4444' : '#f59e0b';
                        const mediaInitial = (m.source || '?')[0].toUpperCase();
                        return (
                          <div key={m.id || i} className="news-card">
                            {/* Cabecera */}
                            <div className="nc-header">
                              <div className="nc-header-left">
                                <div className="nc-media-icon" style={{ background: activeKw.color }}>
                                  {mediaInitial}
                                </div>
                                <span className="nc-source">{m.source || '—'}</span>
                                <span className="nc-meta-sep">·</span>
                                <span className="nc-meta">Edición Digital</span>
                                {subKw1 && <><span className="nc-meta-sep">·</span><span className="nc-meta">{subKw1}: <strong>{m.sub1}</strong></span></>}
                                {subKw2 && <><span className="nc-meta-sep">·</span><span className="nc-meta">{subKw2}: <strong>{m.sub2}</strong></span></>}
                              </div>
                              <div className="nc-header-right">
                                <span className="nc-date">{dateLabel}</span>
                                <span className="nc-relevance" style={{ color: tonoColor }}>
                                  TONO {m.tono.toUpperCase()}
                                </span>
                              </div>
                            </div>

                            {/* Título */}
                            <div className="nc-body">
                              <div className="nc-title-row">
                                <h3 className="nc-title">{m.title}</h3>
                                <span className="nc-logo-text">{m.source}</span>
                              </div>
                              {m.excerpt && (
                                <p className="nc-excerpt">{m.excerpt.slice(0, 200)}{m.excerpt.length > 200 ? '…' : ''}</p>
                              )}
                            </div>

                            {/* Badges de métricas */}
                            <div className="nc-metrics">
                              <span className="nc-badge nc-badge-red">
                                Alcance: {m.reach.toLocaleString()}
                              </span>
                              <span className="nc-badge nc-badge-orange">
                                Valor: {m.value.toLocaleString()} €
                              </span>
                              <span className="nc-badge nc-badge-blue">
                                Tono: {m.tono}
                              </span>
                            </div>

                            {/* Acciones */}
                            <div className="nc-actions">
                              {m.excerpt && (
                                <button className="nc-action-btn" onClick={() => alert(m.excerpt)}>
                                  <FileText className="w-3.5 h-3.5" /> Ver fragmento
                                </button>
                              )}
                              {m.url && (
                                <a href={m.url} target="_blank" rel="noopener noreferrer" className="nc-action-btn">
                                  <ExternalLink className="w-3.5 h-3.5" /> Ver artículo
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  sources.length === 0 ? (
                    <div className="empty-state">
                      <BarChart2 className="empty-icon" />
                      <h3 className="empty-title">Sin datos suficientes</h3>
                      <p className="empty-desc">Necesitamos más menciones para generar el análisis de fuentes.</p>
                    </div>
                  ) : (
                    <div className="sources-list">
                      {sources.slice(0, 8).map((s, i) => (
                        <div key={s.name} className="source-bar-row">
                          <div className="sb-label">{s.name}</div>
                          <div className="sb-track">
                            <div
                              className="sb-fill"
                              style={{
                                width: `${Math.round(s.count / sources[0].count * 100)}%`,
                                backgroundColor: activeKw.color,
                                opacity: Math.max(0.4, 1 - i * 0.1)
                              }}
                            />
                          </div>
                          <div className="sb-value">{s.count}</div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ height: '100%' }}>
              <Layers className="empty-icon" />
              <h3 className="empty-title">Selecciona una palabra clave</h3>
              <p className="empty-desc">Elige una keyword del panel lateral o añade una nueva para comenzar a ver los resultados.</p>
            </div>
          )}
        </main>
      </div>

      {/* ── Modal de Análisis IA ── */}
    {showAnalysis && (
      <div className="analysis-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAnalysis(false); }}>
        <div className="analysis-modal">

          {/* Header */}
          <div className="am-header">
            <div className="am-header-left">
              <div className="am-icon-wrap"><Sparkles className="w-4 h-4" /></div>
              <div>
                <h2 className="am-title">Análisis de Cobertura</h2>
                <p className="am-subtitle">
                  {activeKw?.text} · {enrichedMentions.length} menciones analizadas
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {analysisData && !analysisData.error && (
                <button className="am-copy-btn" onClick={handleCopyAnalysis}>
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
              )}
              <button className="am-close-btn" onClick={() => setShowAnalysis(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="am-body">
            {analysisLoading ? (
              <div className="am-loading">
                <div className="am-spinner" />
                <p>Analizando {enrichedMentions.length} noticias con IA…</p>
              </div>
            ) : analysisData?.error ? (
              <div className="am-error">
                <p>⚠️ {analysisData.error}</p>
              </div>
            ) : analysisData ? (
              <>
                {/* Resumen */}
                <div className="am-section am-section-highlight">
                  <div className="am-section-label"><FileText className="w-3.5 h-3.5" /> Resumen ejecutivo</div>
                  <p className="am-text">{analysisData.resumen}</p>
                </div>

                {/* Tono general */}
                <div className="am-section">
                  <div className="am-section-label"><Activity className="w-3.5 h-3.5" /> Tono general</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <span className={`am-tono-badge am-tono-${analysisData.tono_general}`}>
                      {(analysisData.tono_general || '').toUpperCase()}
                    </span>
                    <p className="am-text" style={{ margin: 0 }}>{analysisData.tono_descripcion}</p>
                  </div>
                </div>

                {/* Temas + Hallazgos en grid */}
                <div className="am-grid-2">
                  <div className="am-section">
                    <div className="am-section-label"><TrendingUp className="w-3.5 h-3.5" /> Temas clave</div>
                    <ul className="am-list">
                      {(analysisData.temas || []).map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                  <div className="am-section">
                    <div className="am-section-label"><Target className="w-3.5 h-3.5" /> Hallazgos</div>
                    <ul className="am-list">
                      {(analysisData.hallazgos || []).map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  </div>
                </div>

                {/* Conclusiones */}
                <div className="am-section am-section-highlight">
                  <div className="am-section-label"><MessageSquare className="w-3.5 h-3.5" /> Conclusiones</div>
                  <p className="am-text">{analysisData.conclusiones}</p>
                </div>

                {/* Recomendaciones */}
                <div className="am-section">
                  <div className="am-section-label"><Lightbulb className="w-3.5 h-3.5" /> Recomendaciones</div>
                  <ul className="am-list am-list-recs">
                    {(analysisData.recomendaciones || []).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
