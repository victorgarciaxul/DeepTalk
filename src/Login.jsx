import { useState } from 'react';

const AUTH_USER = import.meta.env.VITE_AUTH_USER || 'victorgarcia@xul.es';
const AUTH_PASS = import.meta.env.VITE_AUTH_PASS || 'Xul2026';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email.trim() === AUTH_USER && password === AUTH_PASS) {
      sessionStorage.setItem('xul_auth', '1');
      onLogin();
    } else {
      setError('Credenciales incorrectas');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', fontFamily: 'var(--font-sans)'
    }}>
      <div style={{
        background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
        borderRadius: '1rem', padding: '2.5rem 2rem', width: '100%', maxWidth: '360px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            XUL
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Monitor de Medios
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Usuario
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="email@ejemplo.com"
              required
              autoFocus
              style={{
                padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                border: `1px solid ${error ? 'var(--danger)' : 'var(--panel-border)'}`,
                background: 'var(--element-bg)', color: 'var(--text-primary)',
                fontSize: '0.9rem', outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              required
              style={{
                padding: '0.6rem 0.8rem', borderRadius: '0.5rem',
                border: `1px solid ${error ? 'var(--danger)' : 'var(--panel-border)'}`,
                background: 'var(--element-bg)', color: 'var(--text-primary)',
                fontSize: '0.9rem', outline: 'none'
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: '0.8rem', color: 'var(--danger)', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              marginTop: '0.5rem', padding: '0.7rem', borderRadius: '0.5rem',
              background: 'var(--accent)', color: '#fff', border: 'none',
              fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              letterSpacing: '0.03em'
            }}
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
