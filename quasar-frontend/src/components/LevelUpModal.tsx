import { useEffect, useState } from 'react';

interface LevelUpModalProps {
  level:   number;
  onClose: () => void;
}

export function LevelUpModal({ level, onClose }: LevelUpModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));
    // Auto-dismiss after 5s
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClick = () => {
    setVisible(false);
    setTimeout(onClose, 500);
  };

  return (
    <div className={`levelup-overlay ${visible ? 'levelup-overlay--visible' : ''}`} onClick={handleClick}>
      <div className="levelup-card" onClick={e => e.stopPropagation()}>
        {/* Particles */}
        <div className="levelup-particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              className="levelup-particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1.5}s`,
                animationDuration: `${1.5 + Math.random()}s`,
              }}
            />
          ))}
        </div>

        <div className="levelup-star">⭐</div>
        <h2 className="levelup-title">LEVEL UP!</h2>
        <p className="levelup-sublabel">You reached</p>
        <div className="levelup-level">Level {level}</div>
        <button className="btn-primary levelup-btn" onClick={handleClick}>
          Continue Practicing
        </button>
      </div>
    </div>
  );
}
