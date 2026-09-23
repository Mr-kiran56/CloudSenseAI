import React, { useState } from 'react';
import { ShapFeature } from '../../types';
import { Sparkles, HelpCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { clsx } from 'clsx';

interface ShapFeatureChartProps {
  features: ShapFeature[];
  title?: string;
}

export const ShapFeatureChart: React.FC<ShapFeatureChartProps> = ({
  features,
  title = 'SHAP / XAI Feature Attribution',
}) => {
  const [showExplanation, setShowExplanation] = useState(false);

  // Normalize max impact for percentage bar rendering
  const maxImpact = Math.max(...features.map((f) => Math.abs(f.impact)), 0.01);

  return (
    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">{title}</h4>
        </div>
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="inline-flex items-center text-xs text-indigo-600 dark:text-indigo-400 hover:underline gap-1"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>How was this calculated?</span>
        </button>
      </div>

      {showExplanation && (
        <div className="p-3 text-xs bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 rounded-md text-indigo-900 dark:text-indigo-200 leading-relaxed">
          <strong>Explainable AI (SHAP):</strong> Feature attribution measures the exact impact of each metric on CloudSense AI’s optimization model. Positive bars (green/indigo) push the recommendation score higher, while negative values indicate operational friction or countervailing risk.
        </div>
      )}

      <div className="space-y-2 pt-1">
        {features.map((feat, idx) => {
          const isPositive = feat.impact >= 0;
          const barWidthPercent = Math.min(Math.round((Math.abs(feat.impact) / maxImpact) * 100), 100);

          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  {isPositive ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                  )}
                  {feat.feature}
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold">
                  {isPositive ? '+' : ''}{feat.impact.toFixed(2)}
                </span>
              </div>

              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${barWidthPercent}%` }}
                  className={clsx(
                    'h-full rounded-full transition-all duration-300',
                    isPositive ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-rose-500 dark:bg-rose-400'
                  )}
                />
              </div>

              {feat.description && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-4">{feat.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
