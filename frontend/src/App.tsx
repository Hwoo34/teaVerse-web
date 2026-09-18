import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE } from './components/Reveal';
import Layout from './components/Layout';
import Home from './pages/Home';
import TeaKnowledge from './pages/TeaKnowledge';
import Exhibitions from './pages/Exhibitions';
import Products from './pages/Products';
import Artists from './pages/Artists';
import Login from './pages/Login';
import ChatWidget from './components/ChatWidget';

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();
  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Page><Home /></Page>} />
          <Route path="/tea" element={<Page><TeaKnowledge /></Page>} />
          <Route path="/exhibitions" element={<Page><Exhibitions /></Page>} />
          <Route path="/products" element={<Page><Products /></Page>} />
          <Route path="/artists" element={<Page><Artists /></Page>} />
          <Route path="/login" element={<Page><Login /></Page>} />
        </Routes>
      </AnimatePresence>
      <ChatWidget />
    </Layout>
  );
}
