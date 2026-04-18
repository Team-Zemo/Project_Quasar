import { useId } from "react";

interface IdenticonAvatarProps {
  seed: string;
  size?: number;
  className?: string;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seedNumber: number) {
  let state = seedNumber || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function IdenticonAvatar({
  seed,
  size = 40,
  className = "",
}: IdenticonAvatarProps) {
  const clipId = useId();
  const safeSeed = seed.trim() || "user";
  const baseHash = hashString(safeSeed);
  const hue = baseHash % 360;
  const rand = createRng(baseHash);

  const bgColor = `hsl(${hue} 26% 12%)`;
  const shadeA = `hsl(${hue} 72% 42%)`;
  const shadeB = `hsl(${(hue + 18) % 360} 82% 56%)`;
  const shadeC = `hsl(${(hue + 32) % 360} 90% 66%)`;

  const cells: Array<{ x: number; y: number; color: string }> = [];
  const grid = 8;

  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < Math.ceil(grid / 2); x += 1) {
      const value = rand();
      const mirrorX = grid - 1 - x;

      let color: string | null = null;
      if (value > 0.82) color = shadeC;
      else if (value > 0.58) color = shadeB;
      else if (value > 0.34) color = shadeA;

      if (!color) continue;

      cells.push({ x, y, color });
      if (mirrorX !== x) {
        cells.push({ x: mirrorX, y, color });
      }
    }
  }

  return (
    <svg
      viewBox="0 0 8 8"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="4" cy="4" r="4" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="8" height="8" fill={bgColor} />
        {cells.map((cell) => (
          <rect
            key={`${cell.x}-${cell.y}`}
            x={cell.x}
            y={cell.y}
            width="1"
            height="1"
            fill={cell.color}
          />
        ))}
      </g>
    </svg>
  );
}
