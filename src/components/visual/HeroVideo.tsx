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
    <div className="relative w-full flex items-center justify-center lg:justify-end select-none py-1">
      {/* Soft atmospheric ambient glow behind the video */}
      <div
        className="absolute -inset-6 lg:-inset-10 bg-gradient-to-tr from-blue-500/10 via-sky-400/8 to-indigo-500/8 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden
      />

      {/* Main presentation canvas - increased width, decreased height, zero borders */}
      <div className="relative w-full max-w-[580px] lg:max-w-[620px] xl:max-w-[660px] h-[420px] sm:h-[460px] md:h-[480px] lg:h-[500px] xl:h-[520px] flex items-center justify-center overflow-hidden border-0 outline-none shadow-none isolate">
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
          className="w-full h-full object-cover object-[center_38%] scale-[1.03] transform-gpu pointer-events-none select-none border-none outline-none"
          style={{
            WebkitMaskImage:
              'radial-gradient(ellipse 88% 84% at 50% 50%, black 55%, rgba(0,0,0,0.85) 75%, rgba(0,0,0,0.3) 88%, transparent 97%)',
            maskImage:
              'radial-gradient(ellipse 88% 84% at 50% 50%, black 55%, rgba(0,0,0,0.85) 75%, rgba(0,0,0,0.3) 88%, transparent 97%)',
          }}
        />

        {/* 1. Perimeter radial feather - gently melts the outer perimeter into var(--cs-surface) */}
        <div
          className="absolute -inset-2 pointer-events-none z-10"
          style={{
            background:
              'radial-gradient(ellipse 88% 84% at 50% 50%, transparent 58%, rgba(255,255,255,0.4) 74%, rgba(255,255,255,0.85) 86%, var(--cs-surface) 95%)',
          }}
          aria-hidden
        />

        {/* 2. Soft Left edge feather - dissolves the monitor left bezel cut seamlessly into the white hero canvas */}
        <div
          className="absolute inset-y-0 -left-2 w-20 sm:w-28 bg-gradient-to-r from-[var(--cs-surface)] from-15% via-[var(--cs-surface)]/80 to-transparent pointer-events-none z-20"
          aria-hidden
        />

        {/* 3. Soft Right edge feather - dissolves the right boundary seamlessly into the white hero canvas */}
        <div
          className="absolute inset-y-0 -right-2 w-20 sm:w-28 bg-gradient-to-l from-[var(--cs-surface)] from-15% via-[var(--cs-surface)]/80 to-transparent pointer-events-none z-20"
          aria-hidden
        />

        {/* 4. Soft Top edge feather */}
        <div
          className="absolute inset-x-0 -top-2 h-14 sm:h-18 bg-gradient-to-b from-[var(--cs-surface)] from-15% via-[var(--cs-surface)]/80 to-transparent pointer-events-none z-20"
          aria-hidden
        />

        {/* 5. Soft Bottom edge feather */}
        <div
          className="absolute inset-x-0 -bottom-2 h-14 sm:h-18 bg-gradient-to-t from-[var(--cs-surface)] from-15% via-[var(--cs-surface)]/80 to-transparent pointer-events-none z-20"
          aria-hidden
        />

        {/* 6. Four corner dissolve patches - guarantees zero sharp corner lines */}
        <div
          className="absolute -top-2 -right-2 w-20 h-20 bg-[radial-gradient(circle_at_top_right,var(--cs-surface)_45%,transparent_100%)] pointer-events-none z-20"
          aria-hidden
        />
        <div
          className="absolute -top-2 -left-2 w-20 h-20 bg-[radial-gradient(circle_at_top_left,var(--cs-surface)_45%,transparent_100%)] pointer-events-none z-20"
          aria-hidden
        />
        <div
          className="absolute -bottom-2 -right-2 w-20 h-20 bg-[radial-gradient(circle_at_bottom_right,var(--cs-surface)_45%,transparent_100%)] pointer-events-none z-20"
          aria-hidden
        />
        <div
          className="absolute -bottom-2 -left-2 w-20 h-20 bg-[radial-gradient(circle_at_bottom_left,var(--cs-surface)_45%,transparent_100%)] pointer-events-none z-20"
          aria-hidden
        />
      </div>
    </div>
  );
};
