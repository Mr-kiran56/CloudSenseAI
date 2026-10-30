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
        className="absolute -inset-4 sm:-inset-6 lg:-inset-8 bg-gradient-to-tr from-blue-500/10 via-sky-400/8 to-indigo-500/10 rounded-[32px] blur-3xl pointer-events-none -z-10"
        aria-hidden
      />

      {/* Main presentation canvas:
          Exact dimensions: Width: 605px, Height: 633px
          Aspect ratio: Approximately 0.96:1 (605/633)
          Orientation: Nearly square (slightly portrait)
          Clean rounded corners with subtle textured border and shadow - zero white hazing */}
      <div className="relative w-full max-w-[605px] aspect-[605/633] rounded-[24px] overflow-hidden border border-[var(--cs-line)] bg-[var(--cs-surface)] shadow-2xl shadow-slate-900/5 ring-1 ring-black/[0.04] dark:ring-white/[0.08] flex items-center justify-center isolate">
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
          className="w-full h-full object-cover object-[center_45%] pointer-events-none select-none block border-none outline-none"
        />
      </div>
    </div>
  );
};
