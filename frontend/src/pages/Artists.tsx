import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Reveal, Stagger, staggerItem } from '../components/Reveal';
import { getArtists, getProducts } from '../api';
import type { Artist, Product } from '../types';
import './Catalog.css';

export default function Artists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [risingOnly, setRisingOnly] = useState(false);

  useEffect(() => {
    Promise.all([getArtists(), getProducts()])
      .then(([a, p]) => { setArtists(a); setProducts(p); })
      .finally(() => setLoading(false));
  }, []);

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...artists]
      .filter((a) => !risingOnly || a.rising)
      .filter(
        (a) =>
          !s ||
          a.name.toLowerCase().includes(s) ||
          a.bio.toLowerCase().includes(s) ||
          a.style.toLowerCase().includes(s) ||
          a.region.toLowerCase().includes(s),
      )
      .sort((a, b) => Number(b.rising) - Number(a.rising));
  }, [artists, q, risingOnly]);

  return (
    <div className="tv-container">
      <Reveal className="page-head">
        <span className="tv-eyebrow">Artists</span>
        <h1 className="tv-title-lg">
          작가 <span className="page-count">({filtered.length})</span>
        </h1>
        <p className="tv-lead">요즘 주목받는 급부상 작가와 그들의 자사호·차 도구 작품.</p>
      </Reveal>

      <div className="toolbar">
        <div className="search">
          <input className="tv-input" placeholder="작가명·작풍·지역 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="toggle-pill" onClick={() => setRisingOnly((v) => !v)}>
          <span className={`track ${risingOnly ? 'on' : ''}`}><span className="knob" /></span>
          급부상 작가만
        </label>
      </div>

      {loading ? (
        <div className="tv-grid tv-grid-3 catalog-grid">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">조건에 맞는 작가가 없습니다.</div>
      ) : (
        <Stagger className="tv-grid tv-grid-3 catalog-grid">
          {filtered.map((a) => (
            <motion.article key={a.id} variants={staggerItem} className="item-card artist-card tv-card">
              <div className="avatar" style={{ backgroundImage: 'url(/assets/cat-artist.svg)' }}>
                {a.rising && <span className="tv-badge tv-badge-rising rising">🔥 급부상</span>}
              </div>
              <div className="item-head">
                <h3>{a.name}</h3>
              </div>
              <div className="item-body">
                <p className="item-desc">{a.bio}</p>
                <div className="meta-row">
                  <span>🎨 <b>{a.style}</b></span>
                  <span>📍 {a.region}</span>
                </div>
                <div className="flavor-chips">
                  {a.products.map((pid) => (
                    <span key={pid} className="tv-badge">{productName(pid)}</span>
                  ))}
                </div>
              </div>
            </motion.article>
          ))}
        </Stagger>
      )}
    </div>
  );
}
