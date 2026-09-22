import React from 'react';
import { ArrowRight, Compass, Layers, BarChart2 } from 'lucide-react';
import { RESEARCH_EXAMPLES } from './AnalysisCommandBar';

interface EmptyStateViewProps {
  onSelectPrompt: (prompt: string, fixtureId: string) => void;
}

export const EmptyStateView: React.FC<EmptyStateViewProps> = ({ onSelectPrompt }) => {
  const goldenCases = RESEARCH_EXAMPLES.filter((e) => e.category === 'golden');

  return (
    <div className="w-full max-w-4xl mx-auto py-10 sm:py-16 space-y-10">
      {/* Editorial Title */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded bg-stone-200/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-stone-700 tracking-wider">
          投研分析画布
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#111815]">
          机构级智能证券分析工作台
        </h1>
        <p className="text-sm text-stone-600 max-w-xl mx-auto font-sans leading-relaxed">
          以自然语言驱动的高保真金融分析画布。从意图抽取、声明式规范编译到时序计算与图表装配，全链路可审计、可解释。
        </p>
      </div>

      {/* 5 Golden Starter Cases */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-stone-500 px-1 border-b border-stone-200/80 pb-2">
          <span>经典投研分析场景</span>
          <span>5 组标准验证用例</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {goldenCases.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => onSelectPrompt(ex.fullPrompt, ex.id)}
              className="group flex flex-col justify-between rounded-xl border border-stone-200/90 bg-white p-4 text-left shadow-2xs transition hover:border-stone-400 hover:shadow-xs cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-stone-600 group-hover:bg-[#111815] group-hover:text-stone-100 transition">
                    {ex.id}
                  </span>
                  <span className="font-sans text-xs font-semibold text-stone-800">
                    {ex.shortLabel.split('·')[1]?.trim() || ex.shortLabel}
                  </span>
                </div>
                <p className="text-xs text-stone-500 font-sans line-clamp-2 mt-1 leading-relaxed">
                  "{ex.fullPrompt}"
                </p>
              </div>

              <div className="mt-4 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] font-medium text-stone-700 group-hover:text-stone-900">
                <span>生成分析画布</span>
                <ArrowRight className="h-3 w-3 text-stone-400 group-hover:translate-x-0.5 group-hover:text-stone-900 transition-all" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Minimal Footer Principles */}
      <div className="pt-6 border-t border-stone-200/80 flex flex-wrap items-center justify-center gap-8 text-xs text-stone-600">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-stone-600" />
          <span>意图理解</span>
        </div>
        <span className="text-stone-300">→</span>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-stone-600" />
          <span>确定性规范</span>
        </div>
        <span className="text-stone-300">→</span>
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-emerald-700" />
          <span>可验证画布</span>
        </div>
      </div>
    </div>
  );
};
