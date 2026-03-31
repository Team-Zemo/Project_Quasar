import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';

export function CTASection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section
      ref={ref}
      style={{ paddingTop: '120px', paddingBottom: '140px', paddingLeft: '24px', paddingRight: '24px', position: 'relative' }}
    >
      <div style={{ maxWidth: '640px', marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
        {/* Ambient glow */}
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '500px',
            height: '300px',
            borderRadius: '50%',
            background: 'rgba(249,115,22,0.04)',
            filter: 'blur(100px)',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <h2
            className="font-black tracking-tighter text-white"
            style={{ fontSize: 'clamp(32px, 6vw, 56px)', lineHeight: '1.05', marginBottom: '24px' }}
          >
            Stop preparing.
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(to right, #f97316, #fb923c, #f59e0b)' }}
            >
              Start performing.
            </span>
          </h2>

          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.35)', maxWidth: '430px', margin: '0 auto 48px', lineHeight: '1.7' }}>
            Your next interview is closer than you think.
            Practice with AI that adapts to your pace and pushes your boundaries.
          </p>

          <Link to="/register" className="group relative inline-flex">
            <div
              className="absolute opacity-30 group-hover:opacity-50 transition-opacity duration-500"
              style={{ inset: '-6px', borderRadius: '16px', backgroundImage: 'linear-gradient(to right, #f97316, #fb923c)', filter: 'blur(20px)' }}
            />
            <div
              className="relative flex items-center text-black font-bold uppercase transition-all duration-300 group-hover:scale-[1.03] group-active:scale-[0.97]"
              style={{
                gap: '12px',
                padding: '18px 40px',
                borderRadius: '12px',
                backgroundImage: 'linear-gradient(to right, #f97316, #fb923c)',
                fontSize: '15px',
                letterSpacing: '0.04em',
                boxShadow: '0 0 40px rgba(249,115,22,0.25)',
              }}
            >
              Start Your First Interview
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:translate-x-1 transition-transform duration-300">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>

          {/* Subtle reassurance */}
          <p
            className="font-mono uppercase"
            style={{ marginTop: '24px', fontSize: '11px', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.15)' }}
          >
            Free to start &bull; No credit card required
          </p>
        </motion.div>
      </div>
    </section>
  );
}
