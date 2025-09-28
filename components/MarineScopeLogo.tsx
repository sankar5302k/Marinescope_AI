import React from 'react';

const MarineScopeLogo = ({ className }: { className?: string }) => {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="MarineScope AI Logo"
    >
      <defs>
        <radialGradient id="logo-glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" style={{ stopColor: '#00ffff', stopOpacity: 0.8 }} />
          <stop offset="70%" style={{ stopColor: '#00aaff', stopOpacity: 0.4 }} />
          <stop offset="100%" style={{ stopColor: '#0c1a4f', stopOpacity: 0 }} />
        </radialGradient>
        <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
      </defs>

      {/* Outer pulsing ring */}
      <circle cx="50" cy="50" r="48" fill="none" stroke="#00ffff" strokeWidth="1" opacity="0.3">
        <animate
          attributeName="r"
          values="45;49;45"
          dur="3s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.1;0.5;0.1"
          dur="3s"
          repeatCount="indefinite"
        />
      </circle>
      
      {/* Central glow */}
      <circle cx="50" cy="50" r="45" fill="url(#logo-glow)" />

      {/* Main Ashoka Chakra structure */}
      <g stroke="#e0f7fa" strokeWidth="2.5" filter="url(#glow-filter)">
        <circle cx="50" cy="50" r="40" fill="none" />
        <circle cx="50" cy="50" r="20" fill="#030712" />

        {/* 24 Spokes */}
        {Array.from({ length: 24 }).map((_, i) => (
          <line
            key={i}
            x1="50"
            y1="50"
            x2="50"
            y2="10"
            transform={`rotate(${i * 15}, 50, 50)`}
          />
        ))}
      </g>
    </svg>
  );
};

export default MarineScopeLogo;