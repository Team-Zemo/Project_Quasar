interface AudioVisualizerProps {
  isActive: boolean;
  size?: number;
}

export function AudioVisualizer({ isActive, size = 72 }: AudioVisualizerProps) {
  return (
    <div
      className={`audio-viz ${isActive ? 'audio-viz--active' : ''}`}
      style={{ width: size, height: size }}
      aria-label={isActive ? 'Microphone active' : 'Microphone inactive'}
    >
      {/* Glow ring */}
      <div className="audio-viz__glow" />

      {/* Mic icon */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="audio-viz__icon"
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>

      {/* Animated bars (only shown when active) */}
      {isActive && (
        <div className="audio-viz__bars" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`audio-viz__bar audio-viz__bar--${i}`} />
          ))}
        </div>
      )}
    </div>
  );
}
