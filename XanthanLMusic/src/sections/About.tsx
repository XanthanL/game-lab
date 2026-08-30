import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ScrollReveal } from '../components/ScrollReveal';
import { AvatarReveal } from '../components/AvatarReveal';
import { Quote } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export function About() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const textY = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <section id="about" ref={containerRef} className="section-padding relative overflow-hidden">
      <div className="container-custom">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Text content */}
          <motion.div style={{ y: textY }} className="order-2 lg:order-1">
            <ScrollReveal direction="left">
              <span className="text-sm uppercase tracking-widest text-[var(--about-accent)] mb-4 block">
                {t('about.signalSource')}
              </span>
              <h2 className="font-['Orbitron'] text-4xl md:text-5xl lg:text-6xl font-bold mb-8">
                <span className="text-[var(--about-accent)] neon-text-glow">XanthanL</span>
              </h2>
            </ScrollReveal>

            <ScrollReveal direction="left" delay={0.2}>
              <div className="space-y-6 text-white/70 leading-relaxed">
                <p className="text-lg">
                  {t('about.para1')}
                </p>
                <p>
                  {t('about.para2')}
                </p>
                <p>
                  {t('about.para3')}
                </p>
              </div>
            </ScrollReveal>

            {/* Quote */}
            <ScrollReveal delay={0.4}>
              <div className="mt-10 p-6 border-l-2 border-[var(--neon-pink)] bg-gradient-to-r from-[var(--neon-pink)]/5 to-transparent">
                <Quote className="w-8 h-8 text-[var(--neon-pink)] mb-4" />
                <blockquote className="text-xl md:text-2xl font-['Space_Grotesk'] italic text-white/90 mb-4">
                  {t('about.quote')}
                </blockquote>
                <cite className="text-sm text-white/50 not-italic">
                  {t('about.quoteAuthor')}
                </cite>
              </div>
            </ScrollReveal>
          </motion.div>

          {/* Avatar reveal video */}
          <motion.div style={{ y: imageY }} className="order-1 lg:order-2">
            <ScrollReveal direction="right">
              <div className="relative">
                <AvatarReveal />

                {/* Floating badge */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-black/90 backdrop-blur-sm border border-white/10 rounded-full"
                >
                  <span className="text-sm uppercase tracking-widest text-white/80">
                    2026
                  </span>
                </motion.div>
              </div>
            </ScrollReveal>
          </motion.div>
        </div>
      </div>

      {/* Background decorations */}
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[var(--about-accent)]/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2 pointer-events-none" />
    </section>
  );
}
