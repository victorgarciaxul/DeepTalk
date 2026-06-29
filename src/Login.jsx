import { useState, useEffect } from 'react';

// Lista de usuarios autorizados
const AUTH_USERS = [
  { user: 'tech@xul.es',             pass: 'Xul14$'   },
  { user: 'rociohernandez@xul.es',   pass: 'Rocio14$' },
  { user: 'josecastillo@xul.es',     pass: 'Xul14$'   },
  { user: 'carlagarcia@xul.es',      pass: 'Xul14$'   },
  { user: 'jorgemelo@xul.es',        pass: 'Deep2026*' },
];

// Barras del ecualizador — valores fijos
const EQ_BARS = [
  40,70,55,85,35,90,60,45,75,30,80,50,65,40,95,55,70,38,82,48,
  63,77,42,58,88,33,72,52,67,43,78,36,62,47,83,53,69,39,74,44,
  79,57,64,35,87,51,68,41,76,46,55,73,37,84,49,66,44,81,59,28,
  50,65,38,78,43,90,32,71,56,46
];
const EQ_DUR = [
  0.8,1.1,0.9,1.3,0.7,1.2,1.0,0.85,1.15,0.95,1.25,0.75,1.05,1.35,0.82,
  1.18,0.92,1.28,0.78,1.08,1.38,0.83,1.13,0.93,1.23,0.73,1.03,1.33,0.88,
  1.48,0.98,1.18,0.68,1.08,0.88,1.28,0.78,1.18,0.98,1.38,0.84,1.14,0.94,
  1.24,0.74,1.04,1.34,0.89,1.19,0.99,1.09,0.79,1.29,0.89,1.19,0.69,1.09,0.99,1.39,0.85,
  0.91,1.21,0.71,1.31,0.81,1.11,0.61,1.01,0.96,1.16
];
const EQ_DELAY = [
  0,0.2,0.1,0.35,0.05,0.25,0.15,0.3,0.08,0.18,0.28,0.38,0.03,0.23,0.13,
  0.33,0.07,0.27,0.17,0.37,0.02,0.22,0.12,0.32,0.06,0.26,0.16,0.36,0.04,
  0.24,0.14,0.34,0.09,0.29,0.19,0.39,0.01,0.21,0.11,0.31,0.41,0.06,0.16,
  0.26,0.36,0.11,0.21,0.31,0.41,0.16,0.06,0.26,0.36,0.04,0.14,0.24,0.34,0.09,0.19,0.29,
  0.12,0.32,0.02,0.22,0.42,0.07,0.27,0.17,0.37,0.47
];

const FLOAT_WORDS = [
  { w: 'El País',          x: 6,  y: 10, d: 9,  delay: 0   },
  { w: 'RTVE',             x: 80, y: 7,  d: 7,  delay: 1.2 },
  { w: 'ABC',              x: 20, y: 70, d: 11, delay: 2.5 },
  { w: 'Cadena SER',       x: 58, y: 20, d: 8,  delay: 0.8 },
  { w: 'El Mundo',         x: 40, y: 82, d: 10, delay: 3.1 },
  { w: 'Prensa',           x: 87, y: 52, d: 6,  delay: 1.5 },
  { w: 'Noticias',         x: 12, y: 42, d: 12, delay: 0.3 },
  { w: 'Europa Press',     x: 54, y: 62, d: 9,  delay: 2.0 },
  { w: 'La SER',           x: 28, y: 15, d: 7,  delay: 4.0 },
  { w: 'Digital',          x: 72, y: 78, d: 10, delay: 1.8 },
  { w: 'Monitor',          x: 4,  y: 87, d: 8,  delay: 2.7 },
  { w: 'Radio',            x: 91, y: 30, d: 11, delay: 0.5 },
  { w: 'La Vanguardia',    x: 46, y: 33, d: 13, delay: 3.5 },
  { w: 'Clipping',         x: 23, y: 94, d: 7,  delay: 1.0 },
  { w: 'El Confidencial',  x: 63, y: 46, d: 9,  delay: 2.2 },
  { w: 'Medios',           x: 36, y: 57, d: 6,  delay: 0.7 },
  { w: 'COPE',             x: 76, y: 65, d: 8,  delay: 3.8 },
  { w: 'Menciones',        x: 15, y: 28, d: 10, delay: 1.3 },
];

export default function Login({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.style.background = '#07070a';
    return () => { document.body.style.background = ''; };
  }, []);

  // SSO: si AppCenter pasa el email en la URL, entramos sin mostrar el login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoEmail = params.get('sso_email');
    if (!ssoEmail) return;
    const allowed = ['victorgarcia@xul.es','carlagarcia@xul.es','tech@xul.es','josecastillo@xul.es','jorgemelo@xul.es'];
    if (!allowed.includes(ssoEmail.toLowerCase())) return;
    sessionStorage.setItem('xul_auth', '1');
    localStorage.setItem('xul_tracker_email', ssoEmail.toLowerCase());
    window.history.replaceState({}, '', window.location.pathname);
    onLogin();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const valid = AUTH_USERS.some(u => u.user === user.trim() && u.pass === pass);
    if (valid) {
      sessionStorage.setItem('xul_auth', '1');
      localStorage.setItem('xul_tracker_email', user.trim());
      onLogin();
    } else {
      setError('Usuario o contraseña incorrectos.');
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

        .login-screen {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          background: #07070a;
          z-index: 1000;
          overflow: hidden;
          font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
          color: #EDEDEE;
        }

        /* ── Grid de fondo ── */
        .l-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(122,63,175,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(122,63,175,0.05) 1px, transparent 1px);
          background-size: 52px 52px;
          animation: lGridShift 22s linear infinite;
          z-index: 0;
        }
        @keyframes lGridShift {
          0%   { background-position: 0 0; }
          100% { background-position: 52px 52px; }
        }

        /* ── Línea de escaneo ── */
        .l-scan {
          position: absolute;
          left: 0; right: 0;
          height: 1px;
          background: linear-gradient(to right, transparent 0%, rgba(122,63,175,0) 10%, rgba(122,63,175,0.4) 50%, rgba(245,166,35,0.2) 70%, transparent 100%);
          animation: lScan 7s linear infinite;
          z-index: 1;
        }
        @keyframes lScan {
          0%   { top: 0%; }
          100% { top: 100%; }
        }

        /* ── Ondas de radio ── */
        .l-waves {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1;
          pointer-events: none;
        }
        .l-ring {
          position: absolute;
          width: 140px; height: 140px;
          top: 50%; left: 50%;
          margin-top: -70px; margin-left: -70px;
          border-radius: 50%;
          border: 1.5px solid rgba(122,63,175,0.5);
          animation: lRing 5s ease-out infinite;
        }
        .l-ring:nth-child(2) { animation-delay: 1.25s; border-color: rgba(245,166,35,0.35); }
        .l-ring:nth-child(3) { animation-delay: 2.5s;  border-color: rgba(122,63,175,0.25); }
        .l-ring:nth-child(4) { animation-delay: 3.75s; border-color: rgba(245,166,35,0.18); }
        @keyframes lRing {
          0%   { transform: scale(0.3); opacity: 0.8; }
          100% { transform: scale(8);   opacity: 0;   }
        }
        .l-dot {
          position: absolute;
          width: 8px; height: 8px;
          top: 50%; left: 50%;
          margin-top: -4px; margin-left: -4px;
          border-radius: 50%;
          background: #7A3FAF;
          box-shadow: 0 0 18px 5px rgba(122,63,175,0.6);
          animation: lDot 2.2s ease-in-out infinite;
          z-index: 2;
        }
        @keyframes lDot {
          0%, 100% { box-shadow: 0 0 12px 4px rgba(122,63,175,0.5); }
          50%       { box-shadow: 0 0 28px 10px rgba(245,166,35,0.55); }
        }

        /* ── Ecualizador ── */
        .l-eq {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 200px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 3px;
          padding: 0 6px;
          opacity: 0.2;
          z-index: 1;
        }
        .l-bar {
          flex: 1;
          max-width: 14px;
          min-width: 3px;
          border-radius: 3px 3px 0 0;
          background: linear-gradient(to top, #7A3FAF 0%, #a259d8 55%, #F5A623 100%);
          animation: lBar var(--d, 1s) ease-in-out infinite alternate;
          height: 10%;
          will-change: height;
        }
        @keyframes lBar {
          from { height: 5%; }
          to   { height: var(--h, 80%); }
        }

        /* ── Palabras flotantes ── */
        .l-word {
          position: absolute;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(122,63,175,0.22);
          white-space: nowrap;
          animation: lFloat var(--d, 9s) ease-in-out infinite;
          z-index: 1;
        }
        @keyframes lFloat {
          0%   { transform: translateY(16px);  opacity: 0; }
          12%  { opacity: 1; }
          80%  { opacity: 0.3; }
          100% { transform: translateY(-24px); opacity: 0; }
        }

        /* ── Vignette ── */
        .l-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, rgba(7,7,10,0.45) 25%, rgba(7,7,10,0.85) 100%);
          z-index: 2;
          pointer-events: none;
        }

        /* ── Card ── */
        .login-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 400px;
          background: rgba(18,18,22,0.92);
          border: 1px solid rgba(122,63,175,0.2);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(122,63,175,0.08);
          text-align: center;
          backdrop-filter: blur(16px);
          animation: lCardIn 0.7s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes lCardIn {
          from { transform: translateY(24px) scale(0.97); opacity: 0; }
          to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }

        /* Logo auricular */
        .l-logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
        }
        .l-icon-box {
          width: 56px; height: 56px;
          border-radius: 16px;
          background: linear-gradient(145deg, #1a2a1a 0%, #0f1f0f 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 28px rgba(245,166,35,0.22), 0 4px 16px rgba(0,0,0,0.6);
        }
        .l-app-name {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #EDEDEE;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .l-tagline {
          font-size: 11px;
          color: #5A5A6A;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 600;
        }

        /* Form */
        .login-header p {
          color: #7A7A88;
          font-size: 14px;
          margin-bottom: 28px;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          text-align: left;
        }
        .login-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .login-input-group label {
          font-size: 11px;
          font-weight: 700;
          color: #6C6C78;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-left: 4px;
        }
        .login-input {
          background: #0f0f13;
          border: 1px solid #222228;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 15px;
          color: #EDEDEE;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
          font-family: inherit;
        }
        .login-input::placeholder { color: #3A3A44; }
        .login-input:focus {
          border-color: #7A3FAF;
          box-shadow: 0 0 0 3px rgba(122,63,175,0.22);
        }
        .login-error {
          color: #E8473D;
          font-size: 13px;
          text-align: center;
          margin: 0;
          font-weight: 600;
        }
        .login-submit {
          background: #7A3FAF;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 14px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 6px;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          font-family: inherit;
          letter-spacing: -0.01em;
        }
        .login-submit:hover {
          background: #9B5FD0;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(122,63,175,0.4);
        }
        .login-submit:active { transform: translateY(0); }
        .login-footer {
          margin-top: 28px;
          font-size: 11px;
          color: #3C3C48;
          letter-spacing: 0.05em;
        }
      `}</style>

      <div className="login-screen">

        {/* ── Fondo animado ── */}
        <div className="l-grid" />
        <div className="l-scan" />

        <div className="l-waves">
          <div className="l-ring" />
          <div className="l-ring" />
          <div className="l-ring" />
          <div className="l-ring" />
          <div className="l-dot" />
        </div>

        <div className="l-eq">
          {EQ_BARS.map((h, i) => (
            <div
              key={i}
              className="l-bar"
              style={{
                '--h': `${h}%`,
                '--d': `${EQ_DUR[i] ?? 1}s`,
                animationDelay: `${EQ_DELAY[i] ?? 0}s`
              }}
            />
          ))}
        </div>

        {FLOAT_WORDS.map((fw) => (
          <div
            key={fw.w}
            className="l-word"
            style={{
              left: `${fw.x}%`,
              top: `${fw.y}%`,
              '--d': `${fw.d}s`,
              animationDelay: `${fw.delay}s`
            }}
          >
            {fw.w}
          </div>
        ))}

        <div className="l-vignette" />

        {/* ── Card de login ── */}
        <div className="login-card">
          <div className="l-logo-wrap">
            <div className="l-icon-box">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M5 12C5 8.13 8.13 5 12 5C15.87 5 19 8.13 19 12" stroke="#F5A623" strokeWidth="2.2" strokeLinecap="round"/>
                <rect x="3" y="12" width="4" height="6" rx="2" fill="#F5A623"/>
                <rect x="17" y="12" width="4" height="6" rx="2" fill="#F5A623"/>
              </svg>
            </div>
            <div className="l-app-name">DeepTalk</div>
            <div className="l-tagline">Monitor de Medios · XUL</div>
          </div>

          <div className="login-header">
            <p>Bienvenido/a. Introduce tus credenciales.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-input-group">
              <label>Usuario</label>
              <input
                type="text"
                className="login-input"
                placeholder="usuario@xul.es"
                value={user}
                onChange={e => { setUser(e.target.value); setError(''); }}
                required
                autoFocus
              />
            </div>
            <div className="login-input-group">
              <label>Contraseña</label>
              <input
                type="password"
                className="login-input"
                placeholder="••••••••"
                value={pass}
                onChange={e => { setPass(e.target.value); setError(''); }}
                required
              />
            </div>
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-submit">Acceder al Panel</button>
          </form>
          <div className="login-footer">XUL · © 2026</div>
        </div>

      </div>
    </>
  );
}
