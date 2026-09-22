import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  CornerDownLeft,
  RotateCcw,
  Sliders,
  ChevronDown,
  Layers,
  AlertTriangle,
  History,
  Check,
} from 'lucide-react';
import type { DashboardSpec } from '../schema/dashboard-spec';

export interface CommandExample {
  id: string;
  shortLabel: string;
  fullPrompt: string;
  category: 'golden' | 'failure';
}

export const RESEARCH_EXAMPLES: CommandExample[] = [
  {
    id: 'G1',
    shortLabel: 'G1 · 收盘价与成交量（跌幅前3天）',
    fullPrompt: '分析 A 公司最近 30 个交易日的收盘价和成交量，并标出跌幅最大的 3 个交易日。',
    category: 'golden',
  },
  {
    id: 'G2',
    shortLabel: 'G2 · 开盘价与收盘价走势对比',
    fullPrompt: '比较 B 公司最近 20 个交易日的开盘价和收盘价走势。',
    category: 'golden',
  },
  {
    id: 'G3',
    shortLabel: 'G3 · 涨跌幅柱状图（涨幅前3天）',
    fullPrompt: '用柱状图展示 A 公司最近 15 个交易日的涨跌幅，并标出涨幅最大的 3 天。',
    category: 'golden',
  },
  {
    id: 'G4',
    shortLabel: 'G4 · 成交量分布（成交量前5天）',
    fullPrompt: '查看 B 公司最近 30 个交易日的成交量，并标出成交量最高的 5 天。',
    category: 'golden',
  },
  {
    id: 'G5',
    shortLabel: 'G5 · 最高价与最低价波动区间',
    fullPrompt: '分析 A 公司最近 20 个交易日的最高价和最低价走势。',
    category: 'golden',
  },
  {
    id: 'FAIL_VALIDATION',
    shortLabel: 'N1 · 校验失败：未知标的代码',
    fullPrompt: '分析 XYZ 公司的走势',
    category: 'failure',
  },
  {
    id: 'FAIL_EMPTY_DATA',
    shortLabel: 'N7 · 数据边界：无历史交易记录',
    fullPrompt: '查看无数据公司的走势',
    category: 'failure',
  },
];

interface AnalysisCommandBarProps {
  onSubmit: (input: string) => void;
  onSelectExample: (prompt: string, fixtureId: string) => void;
  onResetToInitial?: () => void;
  isLoading: boolean;
  currentSpec: DashboardSpec | null;
  activeInstrumentName?: string;
  activeInstrumentSymbol?: string;
  activeTimeRangeCount?: number;
  isModified?: boolean;
  suggestedFollowUp?: string;
}

export const AnalysisCommandBar: React.FC<AnalysisCommandBarProps> = ({
  onSubmit,
  onSelectExample,
  onResetToInitial,
  isLoading,
  currentSpec,
  activeInstrumentName,
  activeInstrumentSymbol,
  activeTimeRangeCount,
  isModified = false,
  suggestedFollowUp,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const isEditing = currentSpec !== null;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    setInputVal('');
  };

  const handleChooseExample = (ex: CommandExample) => {
    setShowPicker(false);
    setInputVal('');
    onSelectExample(ex.fullPrompt, ex.id);
  };

  const handleApplySuggestion = (promptText: string) => {
    setInputVal(promptText);
    onSubmit(promptText);
    setInputVal('');
  };

  return (
    <div className="w-full space-y-2">
      {/* ── Contextual State Line ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2 font-mono">
          <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
          {isEditing ? (
            <div className="flex items-center gap-1.5 text-stone-700">
              <span className="font-semibold text-stone-900 text-[11px]">
                正在编辑当前看板
              </span>
              <span className="text-stone-300">/</span>
              <span className="text-stone-800 font-medium">
                {activeInstrumentName || '标的'}
              </span>
              {activeInstrumentSymbol && (
                <span className="rounded bg-stone-200/80 px-1 py-0.2 text-[10px] text-stone-700">
                  {activeInstrumentSymbol}
                </span>
              )}
              {activeTimeRangeCount && (
                <span className="text-stone-500 text-[11px]">
                  · 最近 {activeTimeRangeCount} 交易日
                </span>
              )}
              {isModified && (
                <span className="ml-1 inline-flex items-center rounded bg-amber-100/80 px-1.5 py-0.2 text-[10px] font-medium text-amber-800">
                  已微调
                </span>
              )}
            </div>
          ) : (
            <span className="text-stone-500 font-normal">
              智能分析指令栏 · 支持一句话生成与持续交互微调
            </span>
          )}
        </div>

        {/* Revert to Initial (when modified) */}
        {isEditing && isModified && onResetToInitial && (
          <button
            type="button"
            onClick={onResetToInitial}
            disabled={isLoading}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-900 transition cursor-pointer"
            title="撤销追问修改，恢复至初始看板状态"
          >
            <RotateCcw className="h-3 w-3" />
            <span>恢复初始看板</span>
          </button>
        )}
      </div>

      {/* ── Single Command Bar Input ─────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`relative flex items-center rounded-xl border bg-white shadow-xs transition-all ${
            isEditing
              ? 'border-stone-400/80 focus-within:border-[#111815] focus-within:ring-2 focus-within:ring-[#111815]/10'
              : 'border-stone-300 focus-within:border-[#111815] focus-within:ring-2 focus-within:ring-[#111815]/10'
          }`}
        >
          {/* Prefix Icon */}
          <div className="pl-3.5 pr-1.5 text-stone-400">
            {isEditing ? (
              <Sliders className="h-4 w-4 text-emerald-800" />
            ) : (
              <Sparkles className="h-4 w-4 text-stone-700" />
            )}
          </div>

          {/* Primary Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isLoading}
            placeholder={
              isEditing
                ? suggestedFollowUp
                  ? `继续调整当前分析，例如：“${suggestedFollowUp}”`
                  : '继续调整当前分析，例如：“把成交量改成涨跌幅” / “改成最近 10 个交易日”……'
                : '输入股票自然语言分析诉求，例如：“分析 A 公司最近 30 个交易日的收盘价和成交量……”'
            }
            className="w-full bg-transparent py-3 pr-28 text-sm text-[#111815] placeholder-stone-400 focus:outline-none disabled:opacity-60 font-sans"
          />

          {/* Suffix Actions */}
          <div className="absolute right-1.5 flex items-center gap-1.5">
            {inputVal && !isLoading && (
              <button
                type="button"
                onClick={() => setInputVal('')}
                className="rounded px-2 py-1 text-xs text-stone-400 hover:text-stone-600 transition cursor-pointer"
              >
                清空
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !inputVal.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#111815] px-3.5 py-1.5 text-xs font-semibold text-stone-100 shadow-xs transition hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{isLoading ? '正在分析...' : isEditing ? '更新分析' : '生成图表'}</span>
              <CornerDownLeft className="h-3 w-3 opacity-70" />
            </button>
          </div>
        </div>
      </form>

      {/* ── Sub-bar: Contextual Quick Actions & Subtle Example Picker ─────── */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-1 pt-0.5 text-xs">
        {/* Left: Dynamic Suggestions */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isEditing ? (
            /* Contextual follow-up suggestions in Editing mode */
            <>
              <span className="text-[11px] text-stone-400">快捷追问：</span>
              {suggestedFollowUp && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleApplySuggestion(suggestedFollowUp)}
                  className="inline-flex items-center gap-1 rounded border border-emerald-700/30 bg-emerald-50/50 px-2 py-0.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100/60 transition cursor-pointer"
                >
                  <span>{suggestedFollowUp}</span>
                  <span className="text-[10px] text-emerald-600">↵ 应用</span>
                </button>
              )}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleApplySuggestion('改成最近 10 个交易日')}
                className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition cursor-pointer"
              >
                <span>缩短至 10 个交易日</span>
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleApplySuggestion('将图表类型换为折线图')}
                className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition cursor-pointer"
              >
                <span>换为折线图</span>
              </button>
            </>
          ) : (
            /* Zero-state initial quick starter pills */
            <>
              <span className="text-[11px] text-stone-400">参考样例：</span>
              {RESEARCH_EXAMPLES.filter((e) => e.category === 'golden').slice(0, 4).map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleChooseExample(ex)}
                  className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-700 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 transition cursor-pointer"
                >
                  <span className="font-mono text-[10px] text-stone-400">{ex.id}</span>
                  <span>{ex.shortLabel.split('·')[1] || ex.shortLabel}</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Right: Subtle Dropdown to switch to any standard or edge test case */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-stone-500 hover:text-stone-900 transition cursor-pointer"
          >
            <span>{isEditing ? '切换其他用例' : '全部预置用例'}</span>
            <ChevronDown
              className={`h-3 w-3 text-stone-400 transition-transform ${
                showPicker ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showPicker && (
            <div className="absolute right-0 top-7 z-40 w-72 rounded-xl border border-stone-200 bg-white p-2 shadow-xl text-xs space-y-1">
              <div className="px-2 py-1 font-mono text-[10px] font-semibold tracking-wider text-stone-400 border-b border-stone-100">
                标准测试用例 (5项)
              </div>
              {RESEARCH_EXAMPLES.filter((e) => e.category === 'golden').map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleChooseExample(ex)}
                  className="w-full text-left rounded px-2 py-1.5 text-xs text-stone-700 hover:bg-stone-100 flex items-center justify-between group transition cursor-pointer"
                >
                  <div className="truncate">
                    <span className="font-mono text-[10px] font-bold text-stone-400 group-hover:text-stone-900 mr-1.5">
                      {ex.id}
                    </span>
                    <span>{ex.shortLabel.split('·')[1] || ex.shortLabel}</span>
                  </div>
                </button>
              ))}

              <div className="mt-1 pt-1 px-2 py-1 font-mono text-[10px] font-semibold tracking-wider text-stone-400 border-t border-stone-100">
                边界与异常用例 (2项)
              </div>
              {RESEARCH_EXAMPLES.filter((e) => e.category === 'failure').map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleChooseExample(ex)}
                  className="w-full text-left rounded px-2 py-1.5 text-xs text-stone-700 hover:bg-amber-50 flex items-center justify-between group transition"
                >
                  <span className="truncate">{ex.shortLabel}</span>
                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
