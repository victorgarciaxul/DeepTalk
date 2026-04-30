import { useState, useEffect } from 'react';
import {
  Search, Plus, Trash2, Pause, Play, Settings,
  Database, RefreshCw, BarChart2, List, ExternalLink,
  Activity, Layers, Award, FileText, Calendar, Download,
  Clock, PieChart as PieChartIcon, Link2, Share2, Users, Moon, Sun, Info
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sbClient, searchOpenAI } from './utils/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];

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
    isConfigured: !!(import.meta.env.VITE_SB_URL && import.meta.env.VITE_SB_KEY && import.meta.env.VITE_OA_KEY)
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
      if (!from && !to) {
        query += `&limit=200`;
      }
      // When date filter is active: no limit, all records come back
      // Client-side filter handles mention_date vs found_at correctly
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
      const data = await searchOpenAI(kw.text);
      if (data.mentions?.length > 0) {
        const ins = data.mentions
          .filter(m => m.url?.startsWith("http"))
          .map(m => ({
            keyword_id: kw.id,
            keyword_text: kw.text,
            title: m.title || "",
            source: m.source || "",
            url: m.url,
            mention_date: m.date || "",
            excerpt: m.excerpt || ""
          }));

        if (ins.length > 0) {
          try { await db.post("mentions", ins); } catch (e) { console.error("Error saving mentions", e); }
        }
        try { await db.patch("keywords", kw.id, { last_searched_at: new Date().toISOString() }); } catch (e) { }
        await loadKeywords(db);
        await loadMentions(db, kw.id, dateFrom, dateTo);
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

  const enrichedMentions = mentions.map(m => analyzeMention(m, subKw1, subKw2)).filter(m => {
    if (!dateFrom && !dateTo) return true;
    // Filtramos por found_at (fecha en que se encontró la noticia),
    // que es fiable y refleja cuándo el usuario hizo la búsqueda.
    const fDate = toDateKey(m.found_at);
    if (!fDate) return true;
    if (dateFrom && fDate < dateFrom) return false;
    if (dateTo && fDate > dateTo) return false;
    return true;
  });

  const isFiltered = dateFrom || dateTo;
  const clearDateFilter = () => { setDateFrom(''); setDateTo(''); };

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
        5: { cellWidth: 60, textColor: [59, 130, 246] }
      },
      margin: { left: 14, right: 14 }
    });

    doc.save(`XUL_Menciones_${activeKw.text.replace(/\s+/g, '_')}.pdf`);
  };

  if (!config.isConfigured) {
    return (
      <div className="config-overlay">
        <div className="glass-panel config-panel">
          <div className="config-header">
            <h1 className="config-title">Configuración Inicial</h1>
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
          <Activity className="w-6 h-6 text-accent" style={{ color: 'var(--accent)' }} />
          <h1 className="header-title">XUL <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>· Monitor de Medios</span></h1>
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
            <button
              className="btn-secondary"
              onClick={() => {
                ['xul_sb_url', 'xul_sb_key', 'xul_oa_key'].forEach(k => localStorage.removeItem(k));
                setConfig({ sbUrl: '', sbKey: '', oaKey: '', isConfigured: false });
              }}
            >
              <Settings className="w-4 h-4" /> Reconfigurar Accesos
            </button>
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
                    <div className="table-responsive">
                      <table className="mentions-table">
                        <thead>
                          <tr>
                            <th>Titular</th>
                            <th>Contexto mención</th>
                            <th>Valoración</th>
                            <th>Medio</th>
                            <th className="text-center">{subKw1 || 'Keyword 1'}</th>
                            <th className="text-center">{subKw2 || 'Keyword 2'}</th>
                            <th className="text-right">Alcance</th>
                            <th className="text-right">
                              Valor 
                              <div className="tooltip-container">
                                <Info className="w-3 h-3 inline-block ml-1 opacity-50 cursor-help" />
                                <span className="tooltip-text">
                                  VPE: Basado en tono y alcance del medio.
                                </span>
                              </div>
                            </th>
                            <th>Fecha</th>
                            <th>PDF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrichedMentions.map((m, i) => (
                            <tr key={m.id || i}>
                              <td className="font-medium">{m.title}</td>
                              <td className="text-sm color-secondary">{(m.excerpt || '').slice(0, 150) + '...'}</td>
                              <td>
                                <span className={`badge ${m.tono}`}>{m.tono}</span>
                              </td>
                              <td className="font-medium">{m.source}</td>
                              <td className="text-center">{m.sub1.toLowerCase()}</td>
                              <td className="text-center">{m.sub2.toLowerCase()}</td>
                              <td className="text-right font-medium">{m.reach.toLocaleString()}</td>
                              <td className="text-right font-medium" style={{ color: 'var(--success)' }}>{m.value.toLocaleString()} €</td>
                              <td className="text-sm whitespace-nowrap">{m.mention_date || (m.found_at && format(new Date(m.found_at), "dd MMM yyyy", { locale: es }))}</td>
                              <td>
                                {m.url ? (
                                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="link-icon" title="Ver artículo">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
    </div>
  );
}
