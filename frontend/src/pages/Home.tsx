import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Reveal, Stagger, staggerItem, EASE } from '../components/Reveal';
import { getTeas, getExhibitions, getProducts, getArtists } from '../api';
import './Home.css';

const CATEGORIES = [
  { to: '/tea', title: '차 정보', desc: '전통차·중국차·한국차·꽃차의 전문 정보와 우리는 법', img: '/assets/cat-tea.svg', tag: '전통차 · 중국차 · 한국차 · 꽃차' },
  { to: '/exhibitions', title: '전시 정보', desc: '차 관련 축제·전시·박람회 일정과 장소', img: '/assets/cat-exhibition.svg', tag: '축제 · 전시 · 박람회' },
  { to: '/products', title: '상품', desc: '다구·다기·자사호 검색과 리뷰·선호도 분석', img: '/assets/cat-product.svg', tag: '다구 · 다기 · 자사호' },
  { to: '/artists', title: '작가', desc: '요즘 주목받는 급부상 작가와 그들의 작품', img: '/assets/cat-artist.svg', tag: '급부상 · 도예 · 공예' },
];

export default function Home() {
  const [stats, setStats] = useState({ tea: 0, exh: 0, prod: 0, artist: 0 });

  useEffect(() => {
    Promise.all([getTeas(), getExhibitions(), getProducts(), getArtists()])
      .then(([t, e, p, a]) =>
        setStats({ tea: t.length, exh: e.length, prod: p.length, artist: a.length }),
      )
      .catch(() => {});
  }, []);

  return (
    <div className="home">
      {/* ===== 히어로 ===== */}
      <section className="hero">
        <div className="hero-bg" style={{ backgroundImage: 'url(/assets/hero-bg.svg)' }} />
        <div className="hero-overlay" />
        <div className="tv-container hero-inner">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="hero-content"
          >
            <span className="tv-eyebrow hero-eyebrow">차의 세계를 잇는 AI 큐레이션</span>
            <h1 className="hero-title">
              한 잔의 차,<br />무한한 이야기.
            </h1>
            <p className="hero-lead">
              전통차부터 자사호까지 — 차에 대한 모든 궁금증을 AI 챗봇에게 물어보세요.
              데이터와 웹을 넘나들며 <b>출처와 함께</b> 답해드립니다.
            </p>
            <div className="hero-actions">
              <Link to="/tea" className="tv-btn tv-btn-primary">차 정보 둘러보기</Link>
              <Link to="/login" className="tv-btn tv-btn-ghost">🍵 챗봇 시작하기</Link>
            </div>
          </motion.div>

          <motion.div
            className="hero-float"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.img
                key={i}
                src="/assets/leaf.svg"
                className={`hero-leaf leaf-${i}`}
                alt=""
                animate={{ y: [0, -14, 0], rotate: [0, 8, 0] }}
                transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}
              />
            ))}
          </motion.div>
        </div>

        {/* 스탯 바 */}
        <div className="tv-container">
          <Stagger className="hero-stats">
            {[
              { n: stats.tea, l: '차 정보' },
              { n: stats.exh, l: '전시' },
              { n: stats.prod, l: '상품' },
              { n: stats.artist, l: '작가' },
            ].map((s) => (
              <motion.div key={s.l} variants={staggerItem} className="stat">
                <span className="stat-num">{s.n}+</span>
                <span className="stat-label">{s.l}</span>
              </motion.div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ===== 카테고리 ===== */}
      <section className="tv-section">
        <div className="tv-container">
          <Reveal>
            <span className="tv-eyebrow">Explore</span>
            <h2 className="tv-title-lg" style={{ marginTop: 12 }}>카테고리별로 만나는 차의 세계</h2>
          </Reveal>

          <Stagger className="tv-grid tv-grid-2 cat-grid">
            {CATEGORIES.map((c) => (
              <motion.div key={c.to} variants={staggerItem}>
                <Link to={c.to} className="cat-card tv-card">
                  <div className="cat-img" style={{ backgroundImage: `url(${c.img})` }}>
                    <span className="tv-badge cat-tag">{c.tag}</span>
                  </div>
                  <div className="cat-body">
                    <h3>{c.title}</h3>
                    <p>{c.desc}</p>
                    <span className="cat-arrow">자세히 보기 →</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ===== 챗봇 하이라이트 ===== */}
      <section className="tv-section chat-highlight">
        <div className="tv-container chat-highlight-inner">
          <Reveal className="chat-highlight-text">
            <span className="tv-eyebrow">AI Chatbot</span>
            <h2 className="tv-title-lg" style={{ marginTop: 12 }}>
              어느 페이지에서든,<br />차 전문가가 함께합니다
            </h2>
            <p className="tv-lead" style={{ marginTop: 16 }}>
              DB에 있으면 근거 데이터로, 없으면 웹을 검색해 <b>출처 링크</b>와 함께 답합니다.
              차와 무관한 질문은 정중히 거절하는 가드레일도 갖췄어요.
            </p>
            <ul className="chat-features">
              <li>✅ 출처 기반 신뢰할 수 있는 답변</li>
              <li>✅ 로그인 사용자 전용 · JWT 보안</li>
              <li>✅ 관리자는 데이터 수집·업데이트 명령 가능</li>
            </ul>
            <Link to="/login" className="tv-btn tv-btn-primary" style={{ marginTop: 8 }}>
              지금 대화 시작하기
            </Link>
          </Reveal>

          <Reveal delay={0.15} className="chat-mock">
            <div className="chat-mock-window">
              <div className="chat-mock-head"><span>🍵 TeaVerse 챗봇</span></div>
              <div className="chat-mock-body">
                <div className="bubble user">철관음은 어떤 차야?</div>
                <div className="bubble bot">
                  철관음은 중국 푸젠성 안시현의 대표 <b>우롱차</b>예요. 난꽃 같은
                  화사한 향과 부드러운 목넘김이 특징입니다.
                  <div className="bubble-src">출처 · Tieguanyin (Wikipedia)</div>
                </div>
                <div className="bubble user">보성 다향대축제 언제야?</div>
                <div className="bubble bot typing"><span></span><span></span><span></span></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
