import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';
import { EASE } from './Reveal';
import { sendChat } from '../api';
import type { ChatResponse } from '../types';
import './ChatWidget.css';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  sources?: ChatResponse['sources'];
  category?: string | null;
  refused?: boolean;
}

const CAT_LABEL: Record<string, string> = {
  'tea-knowledge': '차 정보',
  exhibitions: '전시',
  products: '상품',
  artists: '작가',
};

export default function ChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionId = useRef(`sess-${Math.random().toString(36).slice(2)}`).current;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || !user || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await sendChat(
        text,
        { accessToken: user.accessToken, idToken: user.idToken },
        sessionId,
      );
      setMessages((m) => [...m, {
        role: 'assistant', text: res.reply, sources: res.sources,
        category: res.category, refused: res.refused,
      }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류가 발생했습니다.';
      setMessages((m) => [...m, { role: 'assistant', text: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = user?.isAdmin
    ? ['철관음은 어떤 차야?', '보성 다향대축제 언제야?', '상품 데이터 업데이트해줘']
    : ['우롱차 추천해줘', '자사호 관리법 알려줘', '요즘 뜨는 작가 알려줘'];

  return (
    <>
      <motion.button
        className="fab"
        aria-label="차 챗봇"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        animate={open ? {} : { boxShadow: ['0 8px 28px rgba(61,139,95,.4)', '0 8px 40px rgba(61,139,95,.7)', '0 8px 28px rgba(61,139,95,.4)'] }}
        transition={{ duration: 2.4, repeat: open ? 0 : Infinity }}
      >
        {open ? '✕' : '🍵'}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25, ease: EASE }}
            role="dialog"
          >
            <div className="chat-head">
              <div className="chat-head-title">
                <span className="chat-avatar">🍵</span>
                <div>
                  <b>TeaVerse 챗봇</b>
                  <small>{user ? `${user.isAdmin ? '👑 ' : ''}${user.username}` : '로그인이 필요해요'}</small>
                </div>
              </div>
              <button className="chat-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="chat-body">
              {!user ? (
                <div className="chat-guest">
                  <div className="guest-icon">🔒</div>
                  <h4>로그인이 필요합니다</h4>
                  <p>챗봇은 로그인한 사용자만 이용할 수 있어요. 정보 페이지는 로그인 없이 계속 열람하실 수 있습니다.</p>
                  <button className="tv-btn tv-btn-primary" onClick={() => { setOpen(false); navigate('/login'); }}>
                    로그인 하러 가기
                  </button>
                </div>
              ) : (
                <>
                  {messages.length === 0 && (
                    <div className="chat-welcome">
                      <p>차에 대해 무엇이든 물어보세요 🌿</p>
                      <div className="suggestions">
                        {suggestions.map((s) => (
                          <button key={s} onClick={() => setInput(s)}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      className={`msg ${m.role}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="bubble">
                        {(m.refused || m.category) && (
                          <div className="bubble-tags">
                            {m.refused && <span className="tv-badge">주제 외</span>}
                            {m.category && <span className="tv-badge tv-badge-gold">{CAT_LABEL[m.category] ?? m.category}</span>}
                          </div>
                        )}
                        <div className="bubble-text">{m.text}</div>
                        {m.sources && m.sources.length > 0 && (
                          <div className="bubble-sources">
                            <span className="src-label">출처</span>
                            {m.sources.map((s, j) => (
                              <a key={j} href={s.url} target="_blank" rel="noreferrer">
                                ↗ {s.title} <em>{s.type}</em>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {loading && (
                    <div className="msg assistant">
                      <div className="bubble typing"><span /><span /><span /></div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {user && (
              <div className="chat-input">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                  placeholder="차에 대해 물어보세요"
                  disabled={loading}
                />
                <button onClick={send} disabled={loading || !input.trim()} aria-label="전송">➤</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
