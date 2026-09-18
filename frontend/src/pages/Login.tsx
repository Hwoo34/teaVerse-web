import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EASE } from '../components/Reveal';
import { useAuth } from '../auth/AuthContext';
import './Login.css';

export default function Login() {
  const { login, loading, error, user, logout, isMock } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const onSubmit = async () => {
    try {
      await login(username, password);
      navigate('/');
    } catch {
      /* error는 컨텍스트에서 표시 */
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg" style={{ backgroundImage: 'url(/assets/hero-bg.svg)' }} />
      <div className="login-overlay" />
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="login-logo"><span>🍵</span> TeaVerse</div>

        {user ? (
          <>
            <h2>환영합니다</h2>
            <div className="login-success">
              <b>{user.username}</b> 님으로 로그인되었습니다.{user.isAdmin && ' 👑 (관리자)'}
            </div>
            <button className="tv-btn tv-btn-primary login-submit" onClick={logout}>로그아웃</button>
            <button className="login-link" onClick={() => navigate('/')}>홈으로 돌아가기</button>
          </>
        ) : (
          <>
            <h2>로그인</h2>
            <p className="login-sub">챗봇 이용을 위해 로그인하세요. 정보 페이지는 로그인 없이 열람 가능합니다.</p>

            {isMock && (
              <div className="login-hint">
                💡 개발 모드 · 테스트 계정: admin / user01 / user02
              </div>
            )}
            {error && (
              <motion.div className="login-error" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                {error}
              </motion.div>
            )}

            <label className="login-field">
              <span>아이디</span>
              <input className="tv-input" value={username} placeholder="user01"
                onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="login-field">
              <span>비밀번호</span>
              <input className="tv-input" type="password" value={password} placeholder="비밀번호"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }} />
            </label>

            <button
              className="tv-btn tv-btn-primary login-submit"
              onClick={onSubmit}
              disabled={loading || !username || !password}
            >
              {loading ? '로그인 중…' : '로그인'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
