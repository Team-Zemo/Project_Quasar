import { memo, useRef, useEffect, useState } from 'react';
import { useScroll, useTransform, motion } from 'framer-motion';

const images = [
  // Column 1
  "https://images.unsplash.com/photo-1496559249665-c7e2874707ea?q=80&w=1965&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop",

  // Column 2
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1549605659-32d82da3a059?q=80&w=2000&auto=format&fit=crop",

  // Column 3
  "https://images.unsplash.com/photo-1504384308090-c54be3855092?q=80&w=1974&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1555255707-c07966088b7b?q=80&w=1932&auto=format&fit=crop",

  // Column 4
  "https://images.unsplash.com/photo-1516110833967-0b5716ca1387?q=80&w=1974&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1555255707-c07966088b7b?q=80&w=1932&auto=format&fit=crop",
];

interface ColumnProps {
  images: string[];
  y: import('framer-motion').MotionValue<number>;
}

const Column = memo(({ images, y }: ColumnProps) => {
  return (
    <motion.div
      style={{ y, willChange: 'transform' }}
      className="flex-1 min-w-0 flex flex-col relative"
      // Place columns offset so parallax has room to travel
      // h-[150%] + -top-[25%] centers the oversized column
    >
      <div
        className="flex flex-col"
        style={{
          gap: '24px',
          height: '150%',
          position: 'relative',
          top: '-25%',
        }}
      >
        {images.map((src, i) => (
          <div
            key={i}
            className="w-full overflow-hidden relative"
            style={{
              aspectRatio: '3/4',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <img
              src={src}
              alt="tech visual"
              loading="lazy"
              style={{
                objectFit: 'cover',
                width: '100%',
                height: '100%',
                filter: 'grayscale(100%)',
                transition: 'filter 0.7s ease, transform 0.7s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'grayscale(0%)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'grayscale(100%)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
});

Column.displayName = 'Column';

export function PhotoCarousel() {
  const sectionRef = useRef<HTMLElement>(null);
  const [yRange, setYRange] = useState(400);

  useEffect(() => {
    const updateRange = () => {
      setYRange(window.innerWidth < 768 ? 200 : 400);
    };
    updateRange();
    window.addEventListener('resize', updateRange);
    return () => window.removeEventListener('resize', updateRange);
  }, []);

  // Use global scroll progress since this component is position:fixed
  const { scrollYProgress } = useScroll();

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -yRange]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, yRange]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -yRange]);
  const y4 = useTransform(scrollYProgress, [0, 1], [0, yRange]);

  return (
    <section
      ref={sectionRef}
      className="w-full relative overflow-hidden flex justify-center items-center"
      style={{
        height: '100vh',
        background: '#080810',
        // marginTop: '18vh',
      }}
    >
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 0,
          opacity: 0.08,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top fade from hero */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          zIndex: 5,
          height: '120px',
          background: 'linear-gradient(to bottom, #080810, transparent)',
        }}
      />

      {/* Bottom fade into next section */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          zIndex: 5,
          height: '120px',
          background: 'linear-gradient(to top, #080810, transparent)',
        }}
      />

      {/* Columns container */}
      <div
        className="mx-auto flex"
        style={{
          height: '120%',
          padding: '16px',
          transform: 'rotate(2deg)',
          transformOrigin: 'center',
          maxWidth: '1400px',
          width: '100%',
        }}
      >
        {/* Mobile: 2 columns */}
        <div
          className="flex md:hidden w-full"
          style={{ gap: '8px' }}
        >
          <Column images={images.slice(0, 6)} y={y1} />
          <Column images={images.slice(6, 12)} y={y2} />
        </div>

        {/* Desktop: 4 columns */}
        <div
          className="hidden md:flex w-full"
          style={{ gap: '32px' }}
        >
          <Column images={images.slice(0, 3)} y={y1} />
          <Column images={images.slice(3, 6)} y={y2} />
          <Column images={images.slice(6, 9)} y={y3} />
          <Column images={images.slice(9, 12)} y={y4} />
        </div>
      </div>

      {/* Overlay text with mix-blend-difference */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: 20, mixBlendMode: 'difference' }}
      >
        <h2
          className="font-black tracking-tighter leading-none text-white"
          style={{
            fontSize: '15vw',
            opacity: 1,
            userSelect: 'none',
          }}
        >
          QUASAR
        </h2>
      </div>

      {/* Accent glow behind text */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <div
          style={{
            width: '60vw',
            height: '20vh',
            background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.08) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </div>
    </section>
  );
}
