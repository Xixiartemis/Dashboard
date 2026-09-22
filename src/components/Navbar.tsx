import React from 'react';
import { Compass, FileText, RotateCcw } from 'lucide-react';

interface NavbarProps {
  onReset: () => void;
  hasActiveResult: boolean;
  onOpenDetails?: () => void;
  isDetailsAvailable?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onReset,
  hasActiveResult,
  onOpenDetails,
  isDetailsAvailable,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-stone-200/90 bg-[#FAF9F5]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Institutional Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#111815] text-stone-100 shadow-xs">
            <Compass className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-base font-bold tracking-tight text-[#111815]">
                AI 证券分析工作台
              </span>
              <span className="hidden sm:inline-block text-stone-300">/</span>
              <span className="hidden sm:inline-block text-xs font-mono tracking-wider text-stone-500">
                机构级投研分析看板
              </span>
            </div>
          </div>
        </div>

        {/* Secondary Meta & Single Explainability Action */}
        <div className="flex items-center gap-3">
          {/* Subtle Dataset Status */}
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-stone-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
            <span>内置仿真数据集 · 截至 2025-12-31</span>
          </div>

          {/* Single Unified Explain / Details Action */}
          {isDetailsAvailable && onOpenDetails && (
            <button
              type="button"
              onClick={onOpenDetails}
              className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50 hover:text-stone-900 transition shadow-2xs cursor-pointer"
              title="查看执行流程、生成规范、数据溯源"
            >
              <FileText className="h-3.5 w-3.5 text-stone-600" />
              <span>分析全流程 ↗</span>
            </button>
          )}

          {/* Reset / New Analysis Action */}
          {hasActiveResult && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded border border-stone-200 bg-transparent px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200/50 hover:text-stone-900 transition cursor-pointer"
              title="新建空白研究"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">新建分析</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

