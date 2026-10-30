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
    <div className="relative w-full flex items-center justify-center lg:justify-end select-none">
      {/* Soft atmospheric ambient glow behind the video */}
      <div
        className="absolute -inset-4 sm:-inset-6 lg:-inset-8 bg-gradient-to-tr from-blue-500/10 via-sky-400/8 to-indigo-500/10 rounded-[32px] blur-3xl pointer-events-none -z-10"
        aria-hidden
      />

      {/* Main presentation canvas:
          - Width spans the column (max-w-[540px] xl:max-w-[550px]) to match navbar and below cards exactly on the right edge
          - Decreased height at the top with object-[center_38%] so the monitor is framed prominently without excessive headroom
          - Rounded textured corners (rounded-[24px]), crisp line border, and subtle elevation shadow */}
      <div className="relative w-full max-w-[540px] xl:max-w-[550px] aspect-[1/0.92] sm:aspect-[1/0.90] max-h-[510px] rounded-[24px] overflow-hidden border border-[var(--cs-line)] bg-[var(--cs-surface)] shadow-2xl shadow-slate-900/5 ring-1 ring-black/[0.04] dark:ring-white/[0.08] flex items-center justify-center isolate">
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
          className="w-full h-full object-cover object-[center_38%] scale-[1.02] pointer-events-none select-none block border-none outline-none"
        />
      </div>
    </div>
  );
};
