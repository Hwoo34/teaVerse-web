import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Reveal, Stagger, staggerItem } from '../components/Reveal';
import { getExhibitions } from '../api';
import type { Exhibition } from '../types';
import './Catalog.css';

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function dateParts(iso: string) {
  const d = new Date(iso);
  return { m: MONTHS[d.getMonth()] ?? '', d: d.getDate() || '' };
}

export default function Exhibitions() {
  const [items, setItems] = useState<Exhibition[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    getExhibitions().then(setItems).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...items]
      .filter(
        (e) =>
          !s ||
          e.title.toLowerCase().includes(s) ||
          e.city.toLowerCase().includes(s) ||
          e.venue.toLowerCase().includes(s) ||
          e.description.toLowerCase().includes(s),
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [items, q]);

  return (
    <div className="tv-container">
      <Reveal className="page-head">
        <span className="tv-eyebrow">Exhibitions</span>
        <h1 className="tv-title-lg">
          전시 정보 <span className="page-count">({filtered.length})</span>
        </h1>
        <p className="tv-lead">차 관련 축제·전시·박람회 일정과 장소를 시간 순으로.</p>
      </Reveal>

      <div className="toolbar">
        <div className="search">
          <input className="tv-input" placeholder="전시명·지역 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="exh-list">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 110 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">전시 정보가 없습니다.</div>
      ) : (
        <Stagger className="exh-list">
          {filtered.map((e) => {
            const { m, d } = dateParts(e.startDate);
            return (
              <motion.article key={e.id} variants={staggerItem} className="exh-item">
                <div className="exh-date">
                  <span className="m">{m}</span>
                  <span className="d">{d}</span>
                </div>
                <div className="exh-body tv-card">
                  <h3>{e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.title}</a> : e.title}</h3>
                  <div className="venue">📍 {e.venue} · {e.city}</div>
                  <p>{e.description}</p>
                  <div className="meta-row" style={{ marginTop: 8 }}>
                    <span>🗓 {e.startDate} ~ {e.endDate}</span>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
