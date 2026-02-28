'use client';

interface HojaaLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

export default function HojaaLogo({
  size = 40,
  showText = true,
  className = '',
  textClassName = '',
}: HojaaLogoProps) {
  const uid = `hojaa-${size}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: 'rotate(-3deg)' }}
      >
        <defs>
          <linearGradient id={`${uid}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E4FF1A" />
            <stop offset="100%" stopColor="#c8e600" />
          </linearGradient>
          <clipPath id={`${uid}-c`}>
            <rect width="56" height="56" rx="14" />
          </clipPath>
        </defs>
        {/* Background */}
        <rect width="56" height="56" rx="14" fill={`url(#${uid}-g)`} />
        <g clipPath={`url(#${uid}-c)`}>
          {/* Circle — top right, closer to center */}
          <circle cx="34" cy="20" r="10" fill="none" stroke="#111" strokeWidth="2.5" />
          {/* Arrow — overlapping circle, centered */}
          <g transform="translate(9, 14)">
            <path
              d="M3 8h15M12 2l6 6-6 6"
              stroke="#111"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          {/* Triangle — bottom left, tilted -15deg, closer to center */}
          <polygon
            points="0,-6 -7,6 7,6"
            transform="translate(18,36) rotate(-15)"
            fill="#111"
          />
        </g>
      </svg>
      {showText && (
        <span
          className={`font-display font-extrabold tracking-tight ${
            textClassName || 'text-lg text-neutral-900 dark:text-neutral-100'
          }`}
        >
          hojaa
        </span>
      )}
    </div>
  );
}
