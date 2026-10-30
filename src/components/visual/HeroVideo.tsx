import React, { useRef, useEffect } from 'react';
import { ArrowUpRight, ShieldCheck, Activity, Server, Layers } from 'lucide-react';
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
    <div className="relative w-full flex justify-center lg:justify-center select-none">
      {/* Soft atmospheric ambient glow behind the video */}
      <div
        className="absolute -inset-4 sm:-inset-6 bg-gradient-to-tr from-blue-500/10 via-sky-400/8 to-indigo-500/10 rounded-[28px] blur-2xl pointer-events-none -z-10"
        aria-hidden
      />

      {/* Hero presentation wrapper:
          Contains the clipped video canvas and the floating FinOps metric cards
          that overlay the edges and seamlessly bridge into the text gap */}
      <div className="relative">
        {/* Main video canvas:
            - Top border matches top of "FinOps · SecOps · Explainable AI"
            - Bottom border matches bottom of "Create a workspace" buttons row
            - Exact measured pixel height (targetHeight) */}
        <div
          className="relative w-full max-w-[390px] xl:max-w-[410px] rounded-[20px] overflow-hidden border border-[var(--cs-line)] bg-[var(--cs-surface)] shadow-xl shadow-slate-900/5 ring-1 ring-black/[0.04] dark:ring-white/[0.08] flex items-center justify-center isolate"
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

        {/* =========================================================================
            FLOATING CARD 1 (Top-Left Overhang):
            Overhangs the left edge into the gap between text and video.
            Displays actionable FinOps remediation & projected monthly savings.
           ========================================================================= */}
        <div className="absolute -top-3 sm:top-2 -left-6 sm:-left-12 lg:-left-16 z-30 w-[230px] sm:w-[250px] rounded-2xl bg-white/95 dark:bg-[#13161c]/95 backdrop-blur-md p-3.5 sm:p-4 border border-slate-200/90 dark:border-white/10 shadow-[0_16px_36px_rgba(15,23,42,0.12)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Remediation Policy #102
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
              Approved
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[22px] sm:text-[24px] font-bold tracking-tight text-slate-900 dark:text-white font-mono">
              $3,400.56
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              /mo saved
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Target</span>
            <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 font-medium truncate max-w-[130px]">
              idle-nat-gw-01 · us-east-1
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="flex-1 py-1.5 px-3 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100/90 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 transition-colors text-center"
            >
              Audit SHAP
            </button>
            <button
              type="button"
              className="py-1.5 px-3 rounded-lg text-[11px] font-medium text-white bg-slate-900 dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-1 shadow-sm shrink-0"
            >
              Execute
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            FLOATING CARD 2 (Bottom-Left Overhang):
            Overhangs the bottom-left edge into the whitespace next to the CTA buttons.
            Displays multi-dimensional posture (Fleet, Waste, SecOps approval).
           ========================================================================= */}
        <div className="hidden sm:block absolute -bottom-3 sm:-bottom-2 -left-4 sm:-left-8 lg:-left-12 z-30 w-[210px] sm:w-[230px] rounded-2xl bg-white/95 dark:bg-[#13161c]/95 backdrop-blur-md p-3 sm:p-3.5 border border-slate-200/90 dark:border-white/10 shadow-[0_16px_36px_rgba(15,23,42,0.12)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 grid place-items-center shrink-0">
                  <Server className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                  AWS Fleet
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 shrink-0">
                14 Accounts
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 grid place-items-center shrink-0">
                  <Activity className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                  Idle Volumes
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 shrink-0">
                18 Flagged
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                  SecOps Guard
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 shrink-0">
                Human Approval
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            FLOATING CARD 3 (Mid/Bottom-Right Overhang):
            Overhangs the right edge for balanced layered depth.
            Displays distribution bars & breakdown of top cloud cost drivers.
           ========================================================================= */}
        <div className="hidden sm:block absolute bottom-10 sm:bottom-14 -right-4 sm:-right-8 lg:-right-10 z-30 w-[190px] sm:w-[210px] rounded-2xl bg-white/95 dark:bg-[#13161c]/95 backdrop-blur-md p-3 sm:p-3.5 border border-slate-200/90 dark:border-white/10 shadow-[0_16px_36px_rgba(15,23,42,0.12)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              Cost Drivers Review
            </span>
          </div>

          {/* 4-segment progress indicator bar */}
          <div className="mt-2.5 flex items-center gap-1">
            <div className="h-1 flex-[4] rounded-full bg-blue-600 dark:bg-blue-500" />
            <div className="h-1 flex-[2.5] rounded-full bg-sky-400 dark:bg-sky-400" />
            <div className="h-1 flex-[1.5] rounded-full bg-slate-300 dark:bg-white/20" />
            <div className="h-1 flex-[1] rounded-full bg-slate-200 dark:bg-white/10" />
          </div>

          {/* Driver items with percentages */}
          <div className="mt-2.5 space-y-1.5 text-[10.5px]">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                Compute & Containers
              </span>
              <span className="font-semibold font-mono">68%</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                Cross-AZ Traffic
              </span>
              <span className="font-semibold font-mono">22%</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                Idle EBS & Storage
              </span>
              <span className="font-semibold font-mono">10%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
