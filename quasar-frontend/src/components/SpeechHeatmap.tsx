interface FillerBucket {
  t: number;
  count: number;
  words?: string[];
}

interface SpeechHeatmapProps {
  buckets: FillerBucket[];
}

export function SpeechHeatmap({ buckets }: SpeechHeatmapProps) {
  if (!buckets || buckets.length === 0) {
    return (
      <div className="speech-heatmap speech-heatmap--empty">
        <p>No speech data available</p>
      </div>
    );
  }

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  const getColor = (count: number): string => {
    if (count === 0) return 'rgba(255, 255, 255, 0.05)';
    const intensity = count / maxCount;
    if (intensity < 0.3) return 'rgba(251, 191, 36, 0.3)';  // light amber
    if (intensity < 0.6) return 'rgba(245, 158, 11, 0.6)';  // amber
    if (intensity < 0.8) return 'rgba(239, 68, 68, 0.6)';   // light red
    return 'rgba(220, 38, 38, 0.9)';                         // deep red
  };

  // Find peak segments
  const peakThreshold = maxCount * 0.7;

  return (
    <div className="speech-heatmap">
      <h4 className="speech-heatmap__title">Filler Word Heatmap</h4>
      <p className="speech-heatmap__subtitle">10-second segments • Darker = more fillers</p>

      <div className="heatmap-bar">
        {buckets.map((bucket, i) => {
          const isPeak = bucket.count >= peakThreshold && bucket.count > 0;
          return (
            <div key={i} className="heatmap-segment-wrapper">
              <div
                className={`heatmap-segment ${isPeak ? 'heatmap-segment--peak' : ''}`}
                style={{ backgroundColor: getColor(bucket.count) }}
                title={`${bucket.t}s–${bucket.t + 10}s: ${bucket.count} fillers`}
              >
                {bucket.count > 0 && (
                  <span className="heatmap-segment__count">{bucket.count}</span>
                )}
              </div>
              {isPeak && bucket.words && bucket.words.length > 0 && (
                <div className="heatmap-peak-label">
                  {[...new Set(bucket.words)].slice(0, 2).join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="heatmap-legend">
        <span className="heatmap-legend__item">
          <span className="heatmap-legend__color" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }} />
          None
        </span>
        <span className="heatmap-legend__item">
          <span className="heatmap-legend__color" style={{ backgroundColor: 'rgba(251, 191, 36, 0.3)' }} />
          Low
        </span>
        <span className="heatmap-legend__item">
          <span className="heatmap-legend__color" style={{ backgroundColor: 'rgba(245, 158, 11, 0.6)' }} />
          Medium
        </span>
        <span className="heatmap-legend__item">
          <span className="heatmap-legend__color" style={{ backgroundColor: 'rgba(220, 38, 38, 0.9)' }} />
          High
        </span>
      </div>
    </div>
  );
}
