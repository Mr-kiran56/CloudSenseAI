import React, { useRef, useEffect } from 'react';
import heroVideoSource from '../../assets/cloudsense-intro.mp4';
import heroPosterSource from '../../assets/hero-poster.png';

export const HeroVideo: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.defaultMuted = true;
      video.muted = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay fallback for strict browser policies
        });
      }
    }
  }, []);

  return (
    <div className="relative w-full h-full min-h-[440px] sm:min-h-[500px] lg:min-h-[550px] xl:min-h-[580px] flex items-center justify-center lg:justify-end select-none">
      {/* Soft atmospheric ambient glow behind the video */}
      <div
        className="absolute -inset-8 lg:-inset-12 bg-gradient-to-tr from-blue-500/10 via-sky-400/8 to-indigo-500/8 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden
      />

      {/* Main presentation canvas - matches exact height of left column, collapses seamlessly into white hero surface */}
      <div className="relative w-full max-w-[600px] xl:max-w-[640px] h-full min-h-[440px] sm:min-h-[500px] lg:min-h-[550px] xl:min-h-[580px] flex items-center justify-center overflow-hidden border-0 outline-none shadow-none isolate">
        <video
          ref={videoRef}
          src={heroVideoSource || '/cloudsense-intro.mp4'}
          poster={heroPosterSource || '/hero-poster.png'}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-label="CloudSense AI animated network and cloud cost intelligence visualization"
          className="w-full h-full object-cover object-center scale-[1.03] transform-gpu pointer-events-none select-none border-none outline-none"
          style={{
            WebkitMaskImage:
              'radial-gradient(ellipse 75% 72% at 50% 50%, black 38%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.3) 70%, transparent 82%)',
            maskImage:
              'radial-gradient(ellipse 75% 72% at 50% 50%, black 38%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.3) 70%, transparent 82%)',
          }}
        />

        {/* 1. Perimeter radial feather - dissolves perimeter seamlessly into var(--cs-surface) */}
        <div
          className="absolute -inset-2 pointer-events-none z-10"
          style={{
            background:
              'radial-gradient(ellipse 78% 75% at 50% 50%, transparent 46%, rgba(255,255,255,0.4) 60%, rgba(255,255,255,0.85) 74%, var(--cs-surface) 85%)',
          }}
          aria-hidden
        />

        {/* 2. Soft Left edge feather - dissolves left boundary seamlessly into text column */}
        <div
          className="absolute inset-y-0 -left-2 w-24 sm:w-32 bg-gradient-to-r from-[var(--cs-surface)] from-15% via-[var(--cs-surface)]/85 to-transparent pointer-events-none z-20"
          aria-hidden
        />

        {/* 3. Soft Right edge feather - wide feather extending beyond right edge to ensure zero border line */}
        <div
          className="absolute inset-y-0 -right-2 w-28 sm:w-36 bg-gradient-to-l from-[var(--cs-surface)] from-20% via-[var(--cs-surface)]/90 to-transparent pointer-events-none z-20"
          aria-hidden
        />

        {/* 4. Soft Top edge feather */}
        <div
          className="absolute inset-x-0 -top-2 h-16 sm:h-20 bg-gradient-to-b from-[var(--cs-surface)] from-15% via-[var(--cs-surface)]/85 to-transparent pointer-events-none z-20"
          aria-hidden
        />

        {/* 5. Soft Bottom edge feather */}
        <div
          className="absolute inset-x-0 -bottom-2 h-20 sm:h-24 bg-gradient-to-t from-[var(--cs-surface)] from-15% via-[var(--cs-surface)]/85 to-transparent pointer-events-none z-20"
          aria-hidden
        />

        {/* 6. Top-right corner dissolve patch - eliminates any corner line artifact */}
        <div
          className="absolute -top-3 -right-3 w-36 h-36 bg-[radial-gradient(circle_at_top_right,var(--cs-surface)_45%,transparent_100%)] pointer-events-none z-20"
          aria-hidden
        />

        {/* 7. Bottom-right corner dissolve patch - eliminates any bottom-right corner line artifact */}
        <div
          className="absolute -bottom-3 -right-3 w-36 h-36 bg-[radial-gradient(circle_at_bottom_right,var(--cs-surface)_45%,transparent_100%)] pointer-events-none z-20"
          aria-hidden
        />
      </div>
    </div>
  );
};
