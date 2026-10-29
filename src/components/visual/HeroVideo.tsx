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
    <div className="relative w-full h-full flex items-center justify-center lg:justify-end select-none py-1">
      {/* Soft atmospheric ambient glow behind the video */}
      <div
        className="absolute -inset-4 sm:-inset-6 lg:-inset-8 bg-gradient-to-tr from-blue-500/10 via-sky-400/8 to-indigo-500/8 rounded-3xl blur-3xl pointer-events-none -z-10"
        aria-hidden
      />

      {/* Main presentation canvas - vertical 9:16 mobile fit, matching left text height, zero borders */}
      <div className="relative w-auto h-[480px] sm:h-[540px] md:h-[580px] lg:h-[600px] xl:h-[620px] aspect-[9/16] max-w-full flex items-center justify-center overflow-hidden border-0 outline-none shadow-none isolate">
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
          className="w-full h-full object-cover object-center pointer-events-none select-none border-none outline-none"
          style={{
            WebkitMaskImage:
              'radial-gradient(ellipse 96% 96% at 50% 50%, black 86%, rgba(0,0,0,0.85) 93%, transparent 100%)',
            maskImage:
              'radial-gradient(ellipse 96% 96% at 50% 50%, black 86%, rgba(0,0,0,0.85) 93%, transparent 100%)',
          }}
        />

        {/* 1. Subtle Perimeter feather - only touches the outermost 6% of edges */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              'radial-gradient(ellipse 94% 94% at 50% 50%, transparent 84%, rgba(255,255,255,0.4) 92%, var(--cs-surface) 100%)',
          }}
          aria-hidden
        />

        {/* 2. Corner dissolves - softly melts ONLY the 4 outer corners into white without hazing the video */}
        <div
          className="absolute -top-1 -right-1 w-12 h-12 bg-[radial-gradient(circle_at_top_right,var(--cs-surface)_40%,transparent_100%)] pointer-events-none z-20"
          aria-hidden
        />
        <div
          className="absolute -top-1 -left-1 w-12 h-12 bg-[radial-gradient(circle_at_top_left,var(--cs-surface)_40%,transparent_100%)] pointer-events-none z-20"
          aria-hidden
        />
        <div
          className="absolute -bottom-1 -right-1 w-12 h-12 bg-[radial-gradient(circle_at_bottom_right,var(--cs-surface)_40%,transparent_100%)] pointer-events-none z-20"
          aria-hidden
        />
        <div
          className="absolute -bottom-1 -left-1 w-12 h-12 bg-[radial-gradient(circle_at_bottom_left,var(--cs-surface)_40%,transparent_100%)] pointer-events-none z-20"
          aria-hidden
        />
      </div>
    </div>
  );
};
