import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import SoftAurora from '../components/SoftAurora';

export function HeroSection() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  return (
    <section
      ref={containerRef}
      className="relative flex items-center justify-center overflow-hidden"
      style={{ minHeight: '100dvh' }}
    >
      {/* SoftAurora background */}
      <div className="absolute inset-0 z-0">
        <SoftAurora
          speed={0.35}
          scale={1.8}
          brightness={0.7}
          color1="#f97316"
          color2="#f6da3bff"
          noiseFrequency={2.2}
          noiseAmplitude={1.2}
          bandHeight={0.55}
          bandSpread={1.2}
          octaveDecay={0.12}
          layerOffset={0.3}
          colorSpeed={0.6}
          enableMouseInteraction={true}
          mouseInfluence={0.1}
        />
      </div>

      {/* Radial overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, transparent 30%, #080810 100%)',
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          zIndex: 2,
          height: '160px',
          background: 'linear-gradient(to top, #080810, transparent)',
        }}
      />

      {/* Hero content */}
      <motion.div
        className="relative w-full mx-auto px-6 text-center"
        style={{ y, opacity, scale, zIndex: 10, maxWidth: '900px' }}
      >
        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center"
          style={{ marginBottom: '32px' }}
        >
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f97316] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f97316]" style={{ boxShadow: '0 0 8px #f97316' }} />
            </span>
            <span className="text-xs font-mono font-medium tracking-widest text-white/50 uppercase">
              Powered by Gemini Live API
            </span>
          </div>
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="font-black leading-none tracking-tighter"
          style={{ fontSize: 'clamp(48px, 9vw, 96px)', marginBottom: '24px' }}
        >
          <span className="text-white">Ace Your Next</span>
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(to right, #f97316, #fb923c, #f59e0b)' }}
          >
            Interview
          </span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-white/40 leading-relaxed mx-auto"
          style={{ fontSize: 'clamp(15px, 2vw, 18px)', maxWidth: '520px', marginBottom: '48px' }}
        >
          Real-time AI interviewer with voice, emotion analysis &amp; adaptive difficulty.
          Practice with an AI that thinks, listens, and challenges you — just like a real one.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center"
          style={{ gap: '16px', marginBottom: '64px' }}
        >
          <Link to="/register" className="group relative">
            <div
              className="absolute rounded-2xl opacity-40 blur-lg group-hover:opacity-60 transition-opacity duration-500"
              style={{ inset: '-4px', backgroundImage: 'linear-gradient(to right, #f97316, #fb923c)' }}
            />
            <div
              className="relative flex items-center text-black font-bold uppercase transition-all duration-300 group-hover:scale-[1.02] group-active:scale-[0.98]"
              style={{
                gap: '10px',
                padding: '16px 32px',
                borderRadius: '12px',
                fontSize: '14px',
                letterSpacing: '0.04em',
                backgroundImage: 'linear-gradient(to right, #f97316, #fb923c)',
                boxShadow: '0 0 30px rgba(249,115,22,0.3)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m5 12 7-7 7 7" />
                <path d="M12 19V5" />
              </svg>
              Start Practicing Free
            </div>
          </Link>

          <a
            href="#how-it-works"
            className="flex items-center border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-sm transition-all duration-300 hover:text-white/80"
            style={{
              gap: '8px',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            See How It Works
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </a>
        </motion.div>

        {/* Floating stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center"
          style={{ gap: '48px' }}
        >
          <StatPill label="Latency" value="<500ms" />
          <div className="hidden sm:block" style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.06)' }} />
          <StatPill label="AI Model" value="Gemini" />
          <div className="hidden sm:block" style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.06)' }} />
          <StatPill label="Voice" value="Real-time" className="hidden sm:flex" />
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: '32px', zIndex: 10 }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-[10px] font-mono tracking-widest uppercase text-white/20">Scroll</span>
          <div className="flex items-start justify-center p-1.5 rounded-full border border-white/10" style={{ width: '20px', height: '32px' }}>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-full bg-[#f97316]/60"
              style={{ width: '4px', height: '6px' }}
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function StatPill({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`} style={{ gap: '4px' }}>
      <span className="text-lg sm:text-xl font-bold text-white/80 tracking-tight">{value}</span>
      <span className="text-[10px] font-mono tracking-widest uppercase text-white/25">{label}</span>
    </div>
  );
}
