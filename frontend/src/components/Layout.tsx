import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';
import './Layout.css';

const NAV = [
  { to: '/', label: '홈' },
  { to: '/tea', label: '차 정보' },
  { to: '/exhibitions', label: '전시' },
  { to: '/products', label: '상품' },
  { to: '/artists', label: '작가' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="tv-app">
      <header className={`tv-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="tv-nav-inner tv-container">
          <Link to="/" className="tv-logo" aria-label="TeaVerse 홈">
            <span className="tv-logo-mark">🍵</span>
            <span className="tv-logo-text">TeaVerse</span>
          </Link>

          <nav className="tv-nav-links">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={location.pathname === n.to ? 'active' : ''}
              >
                {n.label}
                {location.pathname === n.to && (
                  <motion.span layoutId="nav-underline" className="tv-nav-underline" />
                )}
              </Link>
            ))}
          </nav>

          <div className="tv-nav-actions">
            {user ? (
              <div className="tv-user">
                <span className="tv-user-badge">
                  {user.isAdmin ? '👑 ' : ''}
                  {user.username}
                </span>
                <button className="tv-btn tv-btn-ghost tv-btn-sm" onClick={logout}>
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                className="tv-btn tv-btn-primary tv-btn-sm"
                onClick={() => navigate('/login')}
              >
                로그인
              </button>
            )}
            <button
              className="tv-burger"
              aria-label="메뉴"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              className="tv-mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {NAV.map((n) => (
                <Link key={n.to} to={n.to}>{n.label}</Link>
              ))}
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main className="tv-main">{children}</main>

      <footer className="tv-footer">
        <div className="tv-container tv-footer-inner">
          <div>
            <div className="tv-logo tv-logo-footer">
              <span className="tv-logo-mark">🍵</span>
              <span className="tv-logo-text">TeaVerse</span>
            </div>
            <p>차(茶)의 세계를 잇는 AI 큐레이션 서비스</p>
          </div>
          <div className="tv-footer-cols">
            <div>
              <h4>둘러보기</h4>
              {NAV.slice(1).map((n) => (
                <Link key={n.to} to={n.to}>{n.label}</Link>
              ))}
            </div>
            <div>
              <h4>서비스</h4>
              <span>AI 챗봇 큐레이션</span>
              <span>데이터 자동 업데이트</span>
              <span>출처 기반 답변</span>
            </div>
          </div>
        </div>
        <div className="tv-footer-bottom tv-container">
          © 2026 TeaVerse · 차 정보 AI 에이전트 · Powered by Amazon Bedrock
        </div>
      </footer>
    </div>
  );
}
