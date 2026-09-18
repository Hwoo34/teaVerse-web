import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Reveal, Stagger, staggerItem } from '../components/Reveal';
import { getTeas } from '../api';
import type { Tea } from '../types';
import './Catalog.css';

const CATS = ['전체', '전통차', '중국차', '한국차', '꽃차'];

export default function TeaKnowledge() {
  const [teas, setTeas] = useState<Tea[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('전체');

  useEffect(() => {
    getTeas().then(setTeas).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return teas
      .filter((t) => cat === '전체' || t.category === cat)
      .filter(
        (t) =>
          !s ||
          t.name.toLowerCase().includes(s) ||
          t.description.toLowerCase().includes(s) ||
          t.origin.toLowerCase().includes(s) ||
          t.flavorNotes.some((f) => f.toLowerCase().includes(s)),
      );
  }, [teas, q, cat]);

  return (
    <div className="tv-container">
      <Reveal className="page-head">
        <span className="tv-eyebrow">Tea Knowledge</span>
        <h1 className="tv-title-lg">
          차 정보 <span className="page-count">({filtered.length})</span>
        </h1>
        <p className="tv-lead">전통차·중국차·한국차·꽃차 등 다양한 차의 전문 정보와 우리는 법.</p>
      </Reveal>

      <div className="toolbar">
        <div className="search">
          <input
            className="tv-input"
            placeholder="차 이름·향·산지 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="chips">
          {CATS.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="tv-grid tv-grid-3 catalog-grid">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">조건에 맞는 차가 없습니다.</div>
      ) : (
        <Stagger className="tv-grid tv-grid-3 catalog-grid">
          {filtered.map((t) => (
            <motion.article key={t.id} variants={staggerItem} className="item-card tv-card">
              <div className="item-head">
                <h3>{t.name}</h3>
                <span className="tv-badge">{t.category}</span>
              </div>
              <div className="item-body">
                <p className="item-desc">{t.description}</p>
                <div className="meta-row">
                  <span>🌏 <b>{t.origin}</b></span>
                  <span>☕ {t.caffeine}</span>
                </div>
                <div className="meta-row">
                  <span>🌡 {t.brewing.temperatureC}℃ · ⏱ {t.brewing.timeSec}s · 🔁 {t.brewing.infusions}회</span>
                </div>
                <div className="flavor-chips">
                  {t.flavorNotes.map((f) => (
                    <span key={f} className="tv-badge tv-badge-gold">{f}</span>
                  ))}
                </div>
                {t.sources.length > 0 && (
                  <div className="sources">
                    <div className="sources-label">출처</div>
                    {t.sources.map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer">↗ {s.title}</a>
                    ))}
                  </div>
                )}
              </div>
            </motion.article>
          ))}
        </Stagger>
      )}
    </div>
  );
}
