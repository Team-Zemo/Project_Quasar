import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Briefcase, Mic, BarChart3, ChevronDown } from 'lucide-react';

const timelineData = [
  {
    id: '01',
    title: 'Choose Your Domain',
    subtitle: 'Setup Phase',
    icon: Briefcase,
    description:
      'Select your target role — from Software Engineer to Product Manager. Optionally upload a job description for hyper-targeted questions.',
    details: [
      'Role-specific question banks',
      'JD parsing & keyword extraction',
      'Difficulty calibration',
    ],
  },
  {
    id: '02',
    title: 'Talk to the AI',
    subtitle: 'Live Interview',
    icon: Mic,
    description:
      'A real-time voice conversation begins. The AI adapts its questions based on your answers, mimicking a genuine interview flow.',
    details: [
      'Sub-500ms voice latency',
      'Adaptive follow-up questions',
      'Natural conversation flow',
    ],
  },
  {
    id: '03',
    title: 'Get Deep Feedback',
    subtitle: 'Analysis Phase',
    icon: BarChart3,
    description:
      'Receive granular scoring, emotion insights, filler-word detection, and actionable suggestions. Track your progress over time.',
    details: [
      'Skill vector scoring',
      'Emotion & confidence analysis',
      'Session-over-session tracking',
    ],
  },
];

const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/* ---------------- Timeline Item ---------------- */

function TimelineItem({
  item,
  index,
}: {
  item: (typeof timelineData)[0];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 85%', 'center 60%'],
  });

  const opacity = useTransform(scrollYProgress, [0, 1], [0.2, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [70, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.95, 1]);

  const handleClick = () => {
    if (isTouchDevice()) setExpanded((prev) => !prev);
  };

  const Icon = item.icon;

  return (
    <motion.div
      ref={ref}
      style={{ opacity, y, scale }}
      className={`relative flex flex-col md:flex-row items-start w-full ${
        index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
      }`}
    >
      <div
        className="flex-1 w-full md:w-1/2 group"
        style={{ paddingRight: index % 2 === 0 ? '40px' : '0', paddingLeft: index % 2 !== 0 ? '40px' : '0' }}
        onClick={handleClick}
        onMouseEnter={() => !isTouchDevice() && setExpanded(true)}
        onMouseLeave={() => !isTouchDevice() && setExpanded(false)}
      >
        <div
          className="relative overflow-hidden cursor-pointer"
          style={{
            padding: '28px 32px',
            borderRadius: '16px',
            border: '1px solid',
            borderColor: expanded
              ? 'rgba(249,115,22,0.3)'
              : 'rgba(255,255,255,0.06)',
            background: expanded
              ? 'rgba(249,115,22,0.04)'
              : 'rgba(255,255,255,0.02)',
            boxShadow: expanded
              ? '0 20px 60px rgba(249,115,22,0.08)'
              : 'none',
            transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span
                className="font-mono font-black"
                style={{
                  fontSize: '28px',
                  color: expanded
                    ? 'rgba(249,115,22,0.4)'
                    : 'rgba(255,255,255,0.08)',
                  transition: 'color 0.4s ease',
                }}
              >
                {item.id}
              </span>

              <div
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  background: expanded
                    ? 'linear-gradient(135deg, #f97316, #fb923c)'
                    : 'rgba(255,255,255,0.05)',
                  color: expanded ? '#000' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.5s ease',
                }}
              >
                <Icon size={20} strokeWidth={2} />
              </div>
            </div>

            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown
                size={18}
                style={{ color: 'rgba(255,255,255,0.25)' }}
              />
            </motion.div>
          </div>

          {/* Title */}
          <h3
            className="font-bold tracking-tight"
            style={{
              fontSize: '20px',
              color: expanded ? '#f97316' : 'rgba(255,255,255,0.9)',
              transition: 'color 0.4s ease',
            }}
          >
            {item.title}
          </h3>

          {/* Subtitle */}
          <p
            className="font-mono uppercase"
            style={{
              fontSize: '10px',
              letterSpacing: '0.4em',
              color: 'rgba(255,255,255,0.25)',
              marginBottom: '12px',
            }}
          >
            {item.subtitle}
          </p>

          {/* Description */}
          <p
            style={{
              fontSize: '14px',
              lineHeight: '1.7',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            {item.description}
          </p>

          {/* Expandable details */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  style={{
                    paddingTop: '20px',
                    marginTop: '20px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <p
                    className="font-bold uppercase"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.1em',
                      color: '#f97316',
                      marginBottom: '12px',
                    }}
                  >
                    Technical Specs
                  </p>

                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {item.details.map((detail, i) => (
                      <li
                        key={i}
                        className="font-mono"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.35)',
                        }}
                      >
                        <div
                          style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            background: '#f97316',
                            flexShrink: 0,
                          }}
                        />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Spacer for the other side */}
      <div className="flex-1 hidden md:block" />
    </motion.div>
  );
}

/* ---------------- Section ---------------- */

export function HowItWorksSection() {
  const containerRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 60%', 'end 20%'],
  });

  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      className="relative w-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        paddingTop: '160px',
        paddingBottom: '160px',
        background: '#080810',
      }}
    >
      <div
        className="relative w-full"
        style={{ maxWidth: '1100px', margin: '0 auto', paddingLeft: '24px', paddingRight: '24px' }}
      >
        {/* Section title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ textAlign: 'center', marginBottom: '120px' }}
        >
          <span
            className="font-mono uppercase"
            style={{
              display: 'block',
              fontSize: '11px',
              letterSpacing: '0.6em',
              color: 'rgba(249,115,22,0.6)',
              marginBottom: '16px',
            }}
          >
            Phase Operations
          </span>

          <h2
            className="font-black uppercase tracking-tighter leading-none"
            style={{
              fontSize: 'clamp(48px, 10vw, 110px)',
              backgroundImage:
                'linear-gradient(to bottom, rgba(234, 140, 32, 1), rgba(155, 131, 70, 1))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            How It Works
          </h2>
        </motion.div>

        {/* Timeline */}
        <div
          className="relative w-full"
          style={{ maxWidth: '960px', margin: '0 auto' }}
        >
          {/* Scroll-progress timeline line */}
          <div
            className="absolute hidden md:block"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              top: 0,
              bottom: 0,
              width: '2px',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <motion.div
              style={{
                scaleY,
                transformOrigin: 'top',
                height: '100%',
                background:
                  'linear-gradient(to bottom, #f97316, #fb923c)',
                boxShadow: '0 0 20px rgba(249,115,22,0.25)',
              }}
            />
          </div>

          {/* Mobile: left-aligned line */}
          <div
            className="absolute block md:hidden"
            style={{
              left: '24px',
              top: 0,
              bottom: 0,
              width: '2px',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <motion.div
              style={{
                scaleY,
                transformOrigin: 'top',
                height: '100%',
                background:
                  'linear-gradient(to bottom, #f97316, #fb923c)',
                boxShadow: '0 0 20px rgba(249,115,22,0.25)',
              }}
            />
          </div>

          {/* Cards */}
          <div
            className="flex flex-col pl-12 md:pl-0"
            style={{ gap: '80px' }}
          >
            {timelineData.map((item, index) => (
              <TimelineItem key={item.id} item={item} index={index} />
            ))}
          </div>
        </div>
      </div>

      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '40%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '500px',
          height: '500px',
          background:
            'radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
        }}
      />
    </section>
  );
}
