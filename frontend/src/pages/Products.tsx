import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Reveal, Stagger, staggerItem } from '../components/Reveal';
import { getProducts } from '../api';
import type { Product } from '../types';
import './Catalog.css';

export default function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [type, setType] = useState('전체');

  useEffect(() => {
    getProducts().then(setItems).finally(() => setLoading(false));
  }, []);

  const types = useMemo(
    () => ['전체', ...Array.from(new Set(items.map((p) => p.type)))],
    [items],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items
      .filter((p) => type === '전체' || p.type === type)
      .filter(
        (p) =>
          !s ||
          p.name.toLowerCase().includes(s) ||
          p.reviewSummary.toLowerCase().includes(s) ||
          p.vendor.toLowerCase().includes(s),
      )
      .sort((a, b) => b.popularity - a.popularity);
  }, [items, q, type]);

  return (
    <div className="tv-container">
      <Reveal className="page-head">
        <span className="tv-eyebrow">Products</span>
        <h1 className="tv-title-lg">
          상품 <span className="page-count">({filtered.length})</span>
        </h1>
        <p className="tv-lead">다구·다기·자사호 등 차 도구와 리뷰·대중 선호 반응 분석.</p>
      </Reveal>

      <div className="toolbar">
        <div className="search">
          <input className="tv-input" placeholder="상품명·판매처·리뷰 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips">
          {types.map((t) => (
            <button key={t} className={`chip ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="tv-grid tv-grid-3 catalog-grid">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">조건에 맞는 상품이 없습니다.</div>
      ) : (
        <Stagger className="tv-grid tv-grid-3 catalog-grid">
          {filtered.map((p) => (
            <motion.article key={p.id} variants={staggerItem} className="item-card tv-card">
              <div className="item-head">
                <h3>{p.name}</h3>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span className="tv-badge tv-badge-clay">{p.type}</span>
                  {p.popularity >= 85 && <span className="tv-badge tv-badge-rising">인기</span>}
                </div>
              </div>
              <div className="item-body">
                <div className="meta-row">
                  <span className="price">{p.price.toLocaleString()}원</span>
                  <span>· {p.vendor}</span>
                  <span className="rating">⭐ {p.rating.toFixed(1)}</span>
                </div>
                <p className="item-desc">{p.reviewSummary}</p>
                <div>
                  <div className="senti-bar">
                    <div className="pos" style={{ width: `${p.sentiment.pos}%` }} />
                    <div className="neu" style={{ width: `${p.sentiment.neu}%` }} />
                    <div className="neg" style={{ width: `${p.sentiment.neg}%` }} />
                  </div>
                  <div className="senti-legend">
                    긍정 {p.sentiment.pos}% · 중립 {p.sentiment.neu}% · 부정 {p.sentiment.neg}%
                  </div>
                </div>
                <div className="sources">
                  <div className="sources-label">상품 연결 / 출처</div>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer">↗ 상품/참고 링크</a>
                  ) : (
                    <span style={{ color: 'var(--ink-300)', fontSize: '0.85rem' }}>링크 없음</span>
                  )}
                </div>
              </div>
            </motion.article>
          ))}
        </Stagger>
      )}
    </div>
  );
}
