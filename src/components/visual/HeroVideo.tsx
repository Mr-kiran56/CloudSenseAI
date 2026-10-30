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
    <div className="relative w-full h-full flex items-center justify-center lg:justify-end select-none">
      {/* Soft atmospheric ambient glow behind the video */}
      <div
        className="absolute -inset-4 sm:-inset-6 bg-gradient-to-tr from-blue-500/10 via-sky-400/8 to-indigo-500/10 rounded-[28px] blur-2xl pointer-events-none -z-10"
        aria-hidden
      />

      {/* Main presentation canvas:
          - Height matches exactly from "FinOps · SecOps · Explainable AI" to "Create a workspace" button (lg:h-full)
          - Width is proportional to match the height cleanly (max-w-[420px] lg:max-w-[430px] aspect-[1.05/1] lg:aspect-auto)
          - Framed with object-[center_36%] to keep the monitor centered without excess headroom
          - Textured rounded corners (rounded-[20px]), subtle border, soft drop shadow, zero white haze */}
      <div className="relative w-full max-w-[420px] lg:max-w-[430px] aspect-[1.05/1] lg:aspect-auto lg:h-full rounded-[20px] overflow-hidden border border-[var(--cs-line)] bg-[var(--cs-surface)] shadow-xl shadow-slate-900/5 ring-1 ring-black/[0.04] dark:ring-white/[0.08] flex items-center justify-center isolate">
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
