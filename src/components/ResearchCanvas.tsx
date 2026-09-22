import React from 'react';
import type { DashboardRunSuccess } from '../application';
import { ChartCard } from './ChartCard';
import { InsightWidgets } from './InsightWidgets';
import { CheckCircle2, ChevronRight, ArrowUpRight, Database, Layers } from 'lucide-react';

interface ResearchCanvasProps {
  result: DashboardRunSuccess;
  onOpenDetails: () => void;
}

export const ResearchCanvas: React.FC<ResearchCanvasProps> = ({
  result,
  onOpenDetails,
}) => {
  const { provenance, charts, insight, input } = result;

  // Active hover synchronization between Chart and Quantitative Display Board
  const [hoveredDate, setHoveredDate] = React.useState<string | null>(null);

  // Identify scenario
  const hasRankingInsight = insight.items?.some((i) => i.type === 'rank');

  const isPriceChart = (c: typeof charts[0]) =>
    c.viewId.includes('price') ||
    c.title.includes('价') ||
    ((c.option as any).series || []).some((s: any) => s.name?.includes('price') || s.name?.includes('close'));

  const isVolumeChart = (c: typeof charts[0]) =>
    c.viewId.includes('volume') ||
    c.title.includes('成交量') ||
    ((c.option as any).series || []).some((s: any) => s.name?.includes('volume'));

  const isDualPriceAndVolume =
    charts.length === 2 &&
    charts.some(isPriceChart) &&
    charts.some(isVolumeChart);

  // Formatted research brief title
  const briefTitle = input.trim();

  return (
    <article className="w-full space-y-6">
      {/* ── 1. Company Research Brief Header (LIGHT SHELL) ────────────────── */}
      <section className="border-b border-stone-200/80 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          {/* Ticker & Title */}
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#111815]">
                {provenance.instrument.displayName}
              </h1>
              <span className="font-mono text-xs font-semibold text-stone-700 bg-stone-200/80 px-2 py-0.5 rounded border border-stone-300/50">
                {provenance.instrument.symbol}
              </span>
              <span className="font-mono text-xs text-stone-400">·</span>
              <span className="font-mono text-xs text-stone-500 uppercase tracking-wider">
                股票证券
              </span>
            </div>

            <p className="mt-2 text-xs sm:text-sm text-stone-600 font-sans max-w-2xl leading-relaxed">
              <span className="font-medium text-stone-900">分析诉求：</span>
              "{briefTitle}"
            </p>
          </div>

          {/* Timeframe & Provenance Meta */}
          <div className="text-right font-mono text-xs text-stone-500 space-y-1">
            <div className="font-medium text-stone-800">
              最近 {provenance.timeRange.count} 个交易日
            </div>
            <div>截至 {provenance.asOf} · {provenance.calendar}</div>
          </div>
        </div>
      </section>

      {/* ── 2. Unified Dark Analytical Canvas (DARK STAGE) ───────────────── */}
      {/* Canvas #111715, Surface #161C19, Primary #F3F5F2, Secondary #8F9994 */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#111715] text-[#F3F5F2] shadow-xl overflow-hidden transition-all">
        {/* Dark Stage Top Bar */}
        <div className="px-5 py-3.5 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3 bg-[#141B18]/70">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/40 uppercase">
              <Layers className="w-3 h-3 text-emerald-400" />
              <span>数据画布</span>
            </div>
            <span className="font-mono text-xs text-[#8F9994]">·</span>
            <span className="font-mono text-xs text-[#E5E9E6] font-medium">
              {provenance.instrument.displayName} ({provenance.instrument.symbol})
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-[#8F9994]">
            <span className="hidden sm:inline">
              最近 {provenance.timeRange.count} 个交易日
            </span>
            <span className="hidden sm:inline text-white/20">|</span>
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>仿真回放</span>
            </span>
          </div>
        </div>

        {/* Dark Stage Analytical Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* LAYOUT PATTERN 1: Price + Volume Dual View with Ranking Scoreboard (G1) */}
          {isDualPriceAndVolume ? (
            <div className="space-y-6">
              {/* Top Row: Price Trend Line + Downside Ranking Scoreboard */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
                {/* Price Chart (2/3 width) */}
                <div className="lg:col-span-2">
                  <ChartCard
                    chart={charts.find(isPriceChart) || charts[0]}
                    activeDate={hoveredDate}
                    onHoverDate={setHoveredDate}
                    height={280}
                  />
                </div>

                {/* Scoreboard (1/3 width) */}
                <div className="h-full">
                  <InsightWidgets
                    insight={insight}
                    layout="sidebar"
                    activeDate={hoveredDate}
                    onHoverDate={setHoveredDate}
                  />
                </div>
              </div>

              {/* Seamless Dark Stage Horizontal Divider */}
              <div className="border-t border-white/[0.07]" />

              {/* Bottom Row: Volume Bar Chart */}
              <div>
                <ChartCard
                  chart={charts.find(isVolumeChart) || charts[1]}
                  activeDate={hoveredDate}
                  onHoverDate={setHoveredDate}
                  height={220}
                />
              </div>
            </div>
          ) : /* LAYOUT PATTERN 2: Single Chart with Ranking Insight (G3, G4) */
          charts.length === 1 && hasRankingInsight ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
              {/* Primary Chart (2/3 width) */}
              <div className="lg:col-span-2">
                <ChartCard
                  chart={charts[0]}
                  activeDate={hoveredDate}
                  onHoverDate={setHoveredDate}
                  height={320}
                />
              </div>

              {/* Quantitative Scoreboard (1/3 width) */}
              <div className="h-full">
                <InsightWidgets
                  insight={insight}
                  layout="sidebar"
                  activeDate={hoveredDate}
                  onHoverDate={setHoveredDate}
                />
              </div>
            </div>
          ) : (
            /* LAYOUT PATTERN 3: Multi-series comparison (G2 open/close, G5 high/low) or standard grid */
            <div className="space-y-5">
              <div
                className={`grid gap-5 ${
                  charts.length >= 2
                    ? 'grid-cols-1 lg:grid-cols-2'
                    : 'grid-cols-1'
                }`}
              >
                {charts.map((chart) => (
                  <ChartCard
                    key={chart.viewId}
                    chart={chart}
                    activeDate={hoveredDate}
                    onHoverDate={setHoveredDate}
                    height={300}
                  />
                ))}
              </div>

              {/* Additional Insight Widgets (e.g. period change) */}
              {insight.items && insight.items.length > 0 && (
                <div className="pt-2">
                  <InsightWidgets
                    insight={insight}
                    layout="grid"
                    activeDate={hoveredDate}
                    onHoverDate={setHoveredDate}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dark Stage Footer Bar */}
        <div className="px-5 py-3 border-t border-white/[0.07] bg-[#141B18]/50 flex items-center justify-between text-xs font-mono text-[#8F9994]">
          <div className="flex items-center gap-2">
            <span>内置仿真数据集 · 最近 {provenance.timeRange.count} 个交易日</span>
            <span className="text-white/20">·</span>
            <span className="hidden sm:inline">{provenance.datasetId}</span>
          </div>

          <button
            type="button"
            onClick={onOpenDetails}
            className="inline-flex items-center gap-1.5 text-[#F3F5F2] hover:text-white transition font-medium cursor-pointer"
          >
            <span>分析全流程拆解</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>
      </section>

      {/* ── 3. Quiet External Footer: Provenance & Compliance (LIGHT SHELL) ── */}
      <footer className="pt-1 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500 font-mono">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-stone-400" />
          <span>
            {provenance.datasetId} · 截至 {provenance.asOf} · {provenance.timezone}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>结构化规范已校验</span>
          </span>

          <button
            type="button"
            onClick={onOpenDetails}
            className="inline-flex items-center gap-1 text-stone-700 hover:text-stone-900 font-sans font-medium transition cursor-pointer"
          >
            <span>技术链路与数据溯源</span>
            <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
          </button>
        </div>
      </footer>
    </article>
  );
};

