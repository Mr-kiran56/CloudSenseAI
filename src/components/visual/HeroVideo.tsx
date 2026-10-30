import React, { useRef, useEffect } from 'react';
import heroVideoSource from '../../assets/cloudsense-intro.mp4';
import heroPosterSource from '../../assets/hero-poster.png';

interface HeroVideoProps {
  targetHeight?: number;
}

export const HeroVideo: React.FC<HeroVideoProps> = ({ targetHeight }) => {
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
    <div className="relative w-full flex justify-center lg:justify-end select-none">
      {/* Soft atmospheric ambient glow behind the video */}
      <div
        className="absolute -inset-4 sm:-inset-6 bg-gradient-to-tr from-blue-500/10 via-sky-400/8 to-indigo-500/10 rounded-[28px] blur-2xl pointer-events-none -z-10"
        aria-hidden
      />

      {/* Main presentation canvas:
          - Top border exactly matches the top of "FinOps · SecOps · Explainable AI"
          - Bottom border exactly matches the bottom of "Create a workspace" buttons row
          - Uses exact measured pixel height (targetHeight) with proportional width
          - Textured rounded corners (rounded-[20px]) with subtle border line and soft shadow */}
      <div
        className="relative w-full max-w-[400px] xl:max-w-[420px] rounded-[20px] overflow-hidden border border-[var(--cs-line)] bg-[var(--cs-surface)] shadow-xl shadow-slate-900/5 ring-1 ring-black/[0.04] dark:ring-white/[0.08] flex items-center justify-center isolate"
        style={{
          height: targetHeight ? `${targetHeight}px` : '370px',
        }}
      >
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
          className="w-full h-full object-cover object-[center_36%] scale-[1.02] pointer-events-none select-none block border-none outline-none"
        />
      </div>
    </div>
  );
};
