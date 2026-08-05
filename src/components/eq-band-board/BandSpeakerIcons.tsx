interface BandSpeakerIconsProps {
  color: string;
  size?: number;
  opacity?: number;
}

export function BandSpeakerIcons({
  color,
  size = 11,
  opacity = 0.92,
}: BandSpeakerIconsProps) {
  return (
    <svg
      width={size * 2 + 4}
      height={size}
      viewBox={`0 0 ${size * 2 + 4} ${size}`}
      aria-hidden
    >
      {[0, size + 4].map((offset) => (
        <g key={offset} transform={`translate(${offset}, 0)`} opacity={opacity}>
          <path
            d={`M0 ${size * 0.35} h${size * 0.22} l${size * 0.28} -${size * 0.22} v${size} l-${size * 0.28} -${size * 0.22} H0 Z`}
            fill={color}
          />
          <path
            d={`M${size * 0.62} ${size * 0.22} q${size * 0.34} ${size * 0.28} ${size * 0.34} ${size * 0.28} t-${size * 0.34} ${size * 0.28}`}
            fill="none"
            stroke={color}
            strokeWidth={size * 0.11}
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}
