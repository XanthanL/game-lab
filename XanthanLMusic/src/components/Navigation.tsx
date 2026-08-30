import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from '../hooks/useTranslation';

const navLinks = [
  { href: '#music', key: 'nav.music' as const },
  { href: '#about', key: 'nav.about' as const },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toggleLanguage, language } = useLanguage();
  const { t } = useTranslation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const langLabel = language === 'en' ? 'ZH' : 'EN';

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-black/80 backdrop-blur-lg border-b border-white/5'
            : 'bg-transparent'
        }`}
      >
        <div className="container-custom">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <a href="#" className="font-['Orbitron'] text-xl font-bold tracking-wider">
              <span className="neon-text-glow">XANTHAN</span>
              <span className="text-white">L</span>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="nav-link">
                  {t(link.key)}
                </a>
              ))}
              <button
                onClick={toggleLanguage}
                className="ml-2 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white/70 border border-white/10 rounded-full hover:border-[var(--neon-purple)] hover:text-[var(--neon-purple)] transition-colors"
                aria-label="Toggle language"
              >
                {langLabel}
              </button>
            </div>

            {/* Mobile controls */}
            <div className="flex items-center gap-3 md:hidden">
              <button
                onClick={toggleLanguage}
                className="px-3 py-1 text-xs font-medium uppercase tracking-widest text-white/70 border border-white/10 rounded-full hover:border-[var(--neon-purple)] hover:text-[var(--neon-purple)] transition-colors"
                aria-label="Toggle language"
              >
                {langLabel}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-white hover:text-[var(--neon-purple)] transition-colors"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-black/95 backdrop-blur-xl md:hidden pt-20"
          >
            <div className="flex flex-col items-center justify-center h-full gap-8">
              {navLinks.map((link, index) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="font-['Orbitron'] text-2xl font-bold text-white hover:text-[var(--neon-purple)] transition-colors"
                >
                  {t(link.key)}
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
