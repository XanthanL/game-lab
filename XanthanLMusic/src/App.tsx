import { motion, useScroll, useSpring } from 'framer-motion';
import { StarfieldBackground } from './components/StarfieldBackground';
import { Navigation } from './components/Navigation';
import { Hero } from './sections/Hero';
import { Music } from './sections/Music';
import { About } from './sections/About';
import { Footer } from './sections/Footer';
import { LanguageProvider } from './contexts/LanguageContext';
import './App.css';

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed right-[14px] top-0 bottom-0 w-1 bg-white/5 z-50 origin-top rounded-full"
      style={{ scaleY }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--neon-purple)] via-[var(--neon-pink)] to-[var(--neon-blue)] rounded-full" />
    </motion.div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
        {/* Starfield background */}
        <StarfieldBackground />

        {/* Scroll progress indicator */}
        <ScrollProgress />

        {/* Navigation */}
        <Navigation />

        {/* Main content */}
        <main className="relative z-10">
          <Hero />
          <Music />
          <About />
          <Footer />
        </main>
      </div>
    </LanguageProvider>
  );
}

export default App;
