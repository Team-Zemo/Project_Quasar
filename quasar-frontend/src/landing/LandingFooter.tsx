import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function LandingFooter() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#060610' }}>
      <div
        style={{
          maxWidth: '1280px',
          marginLeft: 'auto',
          marginRight: 'auto',
          padding: '48px 24px',
        }}
      >
        <div
          className="flex flex-col sm:flex-row items-center justify-between"
          style={{ gap: '24px' }}
        >
          {/* Brand */}
          <div className="flex items-center" style={{ gap: '12px' }}>
            <div
              className="flex items-center justify-center text-black font-black"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundImage: 'linear-gradient(to bottom right, #f97316, #fb923c)',
                fontSize: '9px',
              }}
            >
              AI
            </div>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>
              Interview <strong style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Quasar</strong>
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center" style={{ gap: '24px' }}>
            <FooterLink to="/login">Sign In</FooterLink>
            <FooterLink to="/register">Get Started</FooterLink>
          </div>

          {/* Tech stack */}
          <div
            className="flex items-center font-mono"
            style={{ gap: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.05em' }}
          >
            <span>Powered by</span>
            <span style={{ color: 'rgba(249,115,22,0.4)' }}>Gemini Live API</span>
            <span>&bull;</span>
            <span>React + Node.js</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <motion.div whileHover={{ y: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
      <Link
        to={to}
        style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', transition: 'color 0.2s' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
      >
        {children}
      </Link>
    </motion.div>
  );
}
