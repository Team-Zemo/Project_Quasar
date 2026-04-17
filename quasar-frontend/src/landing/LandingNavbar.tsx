import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

export function LandingNavbar() {
  const { isAuthenticated, user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dashboardPath = "/interview";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#080810]/80 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-[72px]">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ rotate: 6, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f97316] to-[#fb923c] p-1.5 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.35)]"
            >
              <img
                src="/Quasar_transparent.svg"
                alt="Quasar logo"
                className="w-full h-full object-contain"
              />
            </motion.div>
            <span className="text-[15px] text-white/55 tracking-tight">
              <strong className="text-white font-bold">Quasar</strong>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#how-it-works">How It Works</NavLink>

            <div className="w-px h-5 bg-white/[0.08] mx-3" />

            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 ml-1">
                  <Link
                    to={dashboardPath}
                    aria-label="Go to dashboard"
                    className="w-7 h-7 rounded-full bg-gradient-to-br from-[#f97316] to-[#fb923c] flex items-center justify-center text-[11px] font-bold text-black hover:scale-105 transition-transform duration-200"
                  >
                    {user?.name?.charAt(0).toUpperCase()}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full text-[13px] font-medium text-white/70 hover:text-white transition-colors duration-200"
                  style={{ padding: "8px 20px" }}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="group relative rounded-full text-[13px] font-bold text-black bg-gradient-to-r from-[#f97316] to-[#fb923c] shadow-[0_0_20px_rgba(249,115,22,0.25)] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] transition-all duration-300 hover:scale-[1.02]"
                  style={{ padding: "10px 20px" }}
                >
                  Get Started
                  <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            <motion.span
              animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
              className="block w-5 h-[2px] bg-white/60 origin-center"
            />
            <motion.span
              animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
              className="block w-5 h-[2px] bg-white/60"
            />
            <motion.span
              animate={
                mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }
              }
              className="block w-5 h-[2px] bg-white/60 origin-center"
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden overflow-hidden bg-[#0a0a14]/95 backdrop-blur-2xl border-t border-white/[0.06]"
          >
            <div className="flex flex-col gap-1 p-4">
              <MobileNavLink
                href="#features"
                onClick={() => setMobileOpen(false)}
              >
                Features
              </MobileNavLink>
              <MobileNavLink
                href="#how-it-works"
                onClick={() => setMobileOpen(false)}
              >
                How It Works
              </MobileNavLink>
              <div className="h-px bg-white/[0.06] my-2" />
              {isAuthenticated ? (
                <Link
                  to={dashboardPath}
                  className="flex items-center gap-2 rounded-xl text-sm font-semibold text-[#f97316] bg-[#f97316]/[0.08] border border-[#f97316]/20"
                  style={{ padding: "12px 16px" }}
                >
                  Dashboard →
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.04] transition-all"
                    style={{ padding: "12px 16px" }}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl text-sm font-bold text-black bg-gradient-to-r from-[#f97316] to-[#fb923c] text-center"
                    style={{ padding: "12px 16px" }}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="relative rounded-full text-[13px] font-medium text-white/50 hover:text-white/90 transition-colors duration-200 group"
      style={{ padding: "8px 16px" }}
    >
      {children}
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-[#f97316] rounded-full group-hover:w-4 transition-all duration-300" />
    </a>
  );
}

function MobileNavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.04] transition-all"
      style={{ padding: "12px 16px" }}
    >
      {children}
    </a>
  );
}
