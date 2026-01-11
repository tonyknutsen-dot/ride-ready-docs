import { ReactNode } from 'react';

interface MarqueeSignProps {
  children: ReactNode;
  className?: string;
}

export default function MarqueeSign({ children, className = '' }: MarqueeSignProps) {
  // Create an array of light positions around the border
  const lightsPerSide = 12;
  const totalLights = lightsPerSide * 4;
  
  return (
    <div className={`relative inline-block ${className}`}>
      {/* The sign frame */}
      <div className="relative px-6 py-4 sm:px-10 sm:py-6 md:px-14 md:py-8 bg-gradient-to-b from-gray-900 to-black border-4 border-yellow-500 rounded-lg shadow-2xl">
        {/* Inner gold border */}
        <div className="absolute inset-2 border-2 border-yellow-600/50 rounded pointer-events-none" />
        
        {/* Lights container */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
          {/* Top row of lights */}
          {Array.from({ length: lightsPerSide }).map((_, i) => (
            <div
              key={`top-${i}`}
              className="absolute w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-300 shadow-lg"
              style={{
                top: '-4px',
                left: `${(i + 0.5) * (100 / lightsPerSide)}%`,
                transform: 'translateX(-50%)',
                animation: `marquee-blink 1s ease-in-out infinite`,
                animationDelay: `${(i * 0.1) % 0.5}s`,
                boxShadow: '0 0 8px 2px rgba(253, 224, 71, 0.8)',
              }}
            />
          ))}
          
          {/* Bottom row of lights */}
          {Array.from({ length: lightsPerSide }).map((_, i) => (
            <div
              key={`bottom-${i}`}
              className="absolute w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-300 shadow-lg"
              style={{
                bottom: '-4px',
                left: `${(i + 0.5) * (100 / lightsPerSide)}%`,
                transform: 'translateX(-50%)',
                animation: `marquee-blink 1s ease-in-out infinite`,
                animationDelay: `${((i + 6) * 0.1) % 0.5}s`,
                boxShadow: '0 0 8px 2px rgba(253, 224, 71, 0.8)',
              }}
            />
          ))}
          
          {/* Left column of lights */}
          {Array.from({ length: Math.floor(lightsPerSide * 0.6) }).map((_, i) => (
            <div
              key={`left-${i}`}
              className="absolute w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-300 shadow-lg"
              style={{
                left: '-4px',
                top: `${(i + 0.5) * (100 / (lightsPerSide * 0.6))}%`,
                transform: 'translateY(-50%)',
                animation: `marquee-blink 1s ease-in-out infinite`,
                animationDelay: `${((i + 3) * 0.1) % 0.5}s`,
                boxShadow: '0 0 8px 2px rgba(253, 224, 71, 0.8)',
              }}
            />
          ))}
          
          {/* Right column of lights */}
          {Array.from({ length: Math.floor(lightsPerSide * 0.6) }).map((_, i) => (
            <div
              key={`right-${i}`}
              className="absolute w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-300 shadow-lg"
              style={{
                right: '-4px',
                top: `${(i + 0.5) * (100 / (lightsPerSide * 0.6))}%`,
                transform: 'translateY(-50%)',
                animation: `marquee-blink 1s ease-in-out infinite`,
                animationDelay: `${((i + 9) * 0.1) % 0.5}s`,
                boxShadow: '0 0 8px 2px rgba(253, 224, 71, 0.8)',
              }}
            />
          ))}
        </div>
        
        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}