import { useState, useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
} from "framer-motion";

const features = [
  {
    id: 1,
    title: "Real-time",
    subtitle: "Voice",
    preview: "Natural voice flow with almost instant turn-taking.",
    description:
      "Live bidirectional voice conversation with sub-500ms latency. Talk naturally — the AI listens and responds in real-time.",
    stats: ["<500ms latency", "24kHz audio", "Barge-in ready"],
    image:
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: 2,
    title: "Emotion",
    subtitle: "Analysis",
    preview: "Read confidence, calmness, and hesitation across answers.",
    description:
      "AI detects your confidence, hesitation, and stress patterns. Get feedback on how you emotionally present yourself.",
    stats: ["Stress index", "Tone mapping", "Confidence trend"],
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: 3,
    title: "Persona",
    subtitle: "Selection",
    preview: "Switch interviewer styles based on your target role.",
    description:
      "Choose from multiple interviewer personalities — friendly mentor, tough examiner, or casual peer. Each adapts differently.",
    stats: ["Mentor mode", "Examiner mode", "Peer mode"],
    image:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: 4,
    title: "Progress",
    subtitle: "Tracking",
    preview: "Track session deltas and skill growth over time.",
    description:
      "Skill vectors evolve across sessions. Track your improvements with granular scoring and session-over-session comparisons.",
    stats: ["Skill vectors", "Session deltas", "Weekly trends"],
    image:
      "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=400&auto=format&fit=crop",
  },
];

const springTransition = {
  type: "spring" as const,
  stiffness: 200,
  damping: 30,
  mass: 0.8,
};

const smoothTransition = {
  duration: 0.6,
  ease: [0.23, 1, 0.32, 1] as const,
};

function FeatureCard({
  feature,
  isActive,
  hasSomeActive,
}: {
  feature: (typeof features)[0];
  isActive: boolean;
  hasSomeActive: boolean;
}) {
  return (
    <motion.div
      className="relative w-full overflow-hidden"
      style={{
        borderRadius: "16px",
        willChange: "transform",
      }}
      animate={{
        scale: isActive ? 1.03 : hasSomeActive ? 0.97 : 1,
        opacity: hasSomeActive && !isActive ? 0.45 : 1,
        filter: hasSomeActive && !isActive ? "blur(1.5px)" : "blur(0px)",
        borderColor: isActive
          ? "rgba(249,115,22,0.3)"
          : "rgba(255,255,255,0.06)",
        backgroundColor: isActive
          ? "rgba(249,115,22,0.04)"
          : "rgba(255,255,255,0.02)",
        boxShadow: isActive
          ? "0 20px 60px rgba(249,115,22,0.12), 0 0 40px rgba(249,115,22,0.06)"
          : "0 4px 20px rgba(0,0,0,0.3)",
      }}
      transition={springTransition}
    >
      {/* Image section */}
      <motion.div
        className="w-full relative overflow-hidden"
        animate={{
          height: isActive ? 200 : 118,
          opacity: isActive ? 1 : 0.82,
        }}
        transition={smoothTransition}
      >
        <div
          className="absolute inset-0"
          style={{
            zIndex: 1,
            background:
              "linear-gradient(to bottom, transparent 40%, #080810 100%)",
          }}
        />
        <motion.img
          src={feature.image}
          alt={feature.title}
          loading="lazy"
          animate={{ scale: isActive ? 1.05 : 1.1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: isActive ? "grayscale(50%)" : "grayscale(70%)",
          }}
        />
      </motion.div>

      {/* Content section */}
      <div
        style={{
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Animated accent bar */}
        <motion.div
          animate={{
            width: isActive ? "100%" : "40px",
            background: isActive
              ? "linear-gradient(to right, #f97316, #fb923c)"
              : "rgba(255,255,255,0.08)",
          }}
          transition={springTransition}
          style={{
            height: "2px",
            marginBottom: "20px",
            borderRadius: "2px",
          }}
        />

        {/* Title */}
        <motion.h3
          className="font-bold uppercase tracking-tight"
          animate={{
            color: isActive ? "#f97316" : "rgba(255,255,255,0.9)",
          }}
          transition={{ duration: 0.35 }}
          style={{ fontSize: "22px" }}
        >
          {feature.title}
        </motion.h3>

        {/* Subtitle */}
        <p
          className="font-mono uppercase"
          style={{
            fontSize: "10px",
            letterSpacing: "0.3em",
            color: "rgba(255,255,255,0.3)",
            marginBottom: "16px",
          }}
        >
          {feature.subtitle}
        </p>

        <div className="flex flex-wrap gap-2" style={{ marginBottom: "14px" }}>
          {feature.stats.map((stat) => (
            <span
              key={stat}
              className="font-mono uppercase"
              style={{
                fontSize: "9px",
                letterSpacing: "0.08em",
                padding: "4px 8px",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.55)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {stat}
            </span>
          ))}
        </div>

        {/* Description — desktop: animate in/out; mobile: always visible */}
        <div className="hidden md:block">
          <p
            style={{
              fontSize: "13px",
              lineHeight: "1.7",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {feature.preview}
          </p>
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ maxHeight: 0, opacity: 0, y: 8 }}
                animate={{ maxHeight: 140, opacity: 1, y: 0 }}
                exit={{ maxHeight: 0, opacity: 0, y: 8 }}
                transition={smoothTransition}
                style={{ overflow: "hidden", marginTop: "10px" }}
              >
                <p
                  style={{
                    fontSize: "13px",
                    lineHeight: "1.7",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  {feature.description}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Always visible on mobile */}
        <div className="block md:hidden">
          <p
            style={{
              fontSize: "13px",
              lineHeight: "1.7",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            {feature.description}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: "16px",
          }}
        >
          <motion.span
            className="font-mono uppercase"
            animate={{
              color: isActive ? "#f97316" : "rgba(255,255,255,0.2)",
            }}
            transition={{ duration: 0.35 }}
            style={{ fontSize: "9px", letterSpacing: "0.15em" }}
          >
            {isActive ? "System Active" : "Standby"}
          </motion.span>
          <motion.span
            className="font-black"
            animate={{
              color: isActive
                ? "rgba(249,115,22,0.15)"
                : "rgba(255,255,255,0.04)",
            }}
            transition={{ duration: 0.35 }}
            style={{ fontSize: "32px", lineHeight: 1 }}
          >
            0{feature.id}
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}

export function FeaturesSection() {
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const titleY = useTransform(scrollYProgress, [0, 0.4], [80, 0]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

  return (
    <section
      ref={containerRef}
      id="features"
      className="relative w-full overflow-hidden"
      style={{
        minHeight: "100vh",
        background: "#080810",
        paddingTop: "140px",
        paddingBottom: "140px",
      }}
    >
      {/* Grid background pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.04,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content wrapper */}
      <div
        className="relative w-full flex flex-col items-center justify-center"
        style={{ zIndex: 10 }}
      >
        {/* Title block */}
        <motion.div
          style={{
            y: titleY,
            opacity: titleOpacity,
            willChange: "transform, opacity",
            textAlign: "center",
            marginBottom: "64px",
          }}
        >
          <h2
            className="font-black tracking-tighter uppercase leading-none"
            style={{
              fontSize: "clamp(48px, 10vw, 120px)",
              backgroundImage:
                "linear-gradient(to bottom, rgba(234, 140, 32, 1), rgba(155, 131, 70, 1))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Features
          </h2>
          <p
            className="font-mono uppercase"
            style={{
              marginTop: "8px",
              fontSize: "11px",
              letterSpacing: "0.5em",
              color: "rgba(249,115,22,0.6)",
            }}
          >
            System Capabilities
          </p>
        </motion.div>

        {/* Cards grid */}
        <div
          className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
          style={{
            maxWidth: "1280px",
            paddingLeft: "24px",
            paddingRight: "24px",
            gap: "24px",
          }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 60 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.9,
                delay: 0.12 * index,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative"
              style={{ willChange: "transform" }}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() =>
                setActiveIndex(activeIndex === index ? null : index)
              }
            >
              <FeatureCard
                feature={feature}
                isActive={activeIndex === index}
                hasSomeActive={activeIndex !== null}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "30%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "600px",
          background:
            "radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)",
          filter: "blur(80px)",
          zIndex: 1,
        }}
      />
    </section>
  );
}
