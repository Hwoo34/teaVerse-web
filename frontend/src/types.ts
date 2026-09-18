// 도메인 타입 정의 (PRD §7 스키마 기반)

export interface Source {
  title: string;
  url: string;
  type: 'db' | 'web';
}

export interface Tea {
  id: string;
  name: string;
  category: '전통차' | '중국차' | '한국차' | '꽃차';
  origin: string;
  description: string;
  brewing: { temperatureC: number; timeSec: number; infusions: number };
  flavorNotes: string[];
  caffeine: string;
  imageUrl?: string;
  sources: Source[];
  lastUpdatedAt: string;
  sourceType: string;
}

export interface Exhibition {
  id: string;
  title: string;
  venue: string;
  city: string;
  startDate: string;
  endDate: string;
  description: string;
  url: string;
  sources: Source[];
  lastUpdatedAt: string;
  sourceType: string;
}

export interface Product {
  id: string;
  name: string;
  type: string;
  price: number;
  currency: string;
  vendor: string;
  url: string;
  imageUrl?: string;
  rating: number;
  reviewSummary: string;
  sentiment: { pos: number; neu: number; neg: number };
  popularity: number;
  sources: Source[];
  lastUpdatedAt: string;
  sourceType: string;
}

export interface Artist {
  id: string;
  name: string;
  rising: boolean;
  bio: string;
  region: string;
  style: string;
  products: string[];
  imageUrl?: string;
  sources: Source[];
  note?: string;
  lastUpdatedAt: string;
  sourceType: string;
}

// 챗봇 응답
export interface ChatSource {
  title: string;
  url: string;
  type: 'db' | 'web';
}

export interface ChatResponse {
  reply: string;
  sources: ChatSource[];
  category: string | null;
  refused: boolean;
  adminAction: Record<string, unknown> | null;
}
