import React from 'react';
import type {
  DashboardInsightResult,
  DashboardInsightItem,
  RankInsightItem,
  PeriodChangeInsightItem,
} from '../application';
import { formatMetricValue } from '../utils/formatters';
import { TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';

interface InsightWidgetsProps {
  insight: DashboardInsightResult;
  layout?: 'grid' | 'sidebar';
  activeDate?: string | null;
  onHoverDate?: (date: string | null) => void;
}

export const InsightWidgets: React.FC<InsightWidgetsProps> = ({
  insight,
  layout = 'grid',
  activeDate,
  onHoverDate,
}) => {
  if (!insight || !insight.items || insight.items.length === 0) {
    return null;
  }

  return (
    <div
      className={
        layout === 'sidebar'
          ? 'h-full flex flex-col space-y-4'
          : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
      }
    >
      {insight.items.map((item, idx) => (
        <InsightAnnotationWidget
          key={idx}
          item={item}
          layout={layout}
          activeDate={activeDate}
          onHoverDate={onHoverDate}
        />
      ))}
    </div>
  );
};

export const InsightAnnotationWidget: React.FC<{
  item: DashboardInsightItem;
  layout?: 'grid' | 'sidebar';
  activeDate?: string | null;
  onHoverDate?: (date: string | null) => void;
}> = ({ item, layout, activeDate, onHoverDate }) => {
  if (item.type === 'period_change') {
    return <PeriodChangeAnnotation item={item} />;
  }
  if (item.type === 'rank') {
    return (
      <RankAnnotation
        item={item}
        layout={layout}
        activeDate={activeDate}
        onHoverDate={onHoverDate}
      />
    );
  }
  return null;
};

// ── 1. Period Change Research Annotation ───────────────────────────────────

const PeriodChangeAnnotation: React.FC<{ item: PeriodChangeInsightItem }> = ({
  item,
}) => {
  const isPositive = item.changePct >= 0;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#161C19] p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/[0.07]">
        <span className="font-sans text-xs font-semibold text-[#F3F5F2]">
          周期区间表现
        </span>
        <span className="font-sans text-xs text-[#8F9994] font-medium">
          {item.metricLabel}
        </span>
      </div>

      {/* Typographic Columns */}
      <div className="grid grid-cols-3 gap-2 items-baseline text-left">
        <div>
          <div className="text-[11px] text-[#8F9994]">
            期初值
          </div>
          <div className="font-mono text-sm font-semibold text-[#F3F5F2] mt-0.5">
            {formatMetricValue(item.startValue, item.unit)}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-[#8F9994]">
            期末值
          </div>
          <div className="font-mono text-sm font-bold text-[#F3F5F2] mt-0.5">
            {formatMetricValue(item.endValue, item.unit)}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-[#8F9994]">
            区间涨跌
          </div>
          <div
            className={`font-mono text-sm font-bold mt-0.5 ${
              isPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isPositive ? `+${item.changePct.toFixed(2)}%` : `${item.changePct.toFixed(2)}%`}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 2. Rank Research Annotation (Quantitative Scoreboard) ──────────────────

interface RankAnnotationProps {
  item: RankInsightItem;
  layout?: 'grid' | 'sidebar';
  activeDate?: string | null;
  onHoverDate?: (date: string | null) => void;
}

const RankAnnotation: React.FC<RankAnnotationProps> = ({
  item,
  layout = 'grid',
  activeDate,
  onHoverDate,
}) => {
  const isAscending = item.order === 'asc';
  const isDrop = isAscending || item.transformId.includes('worst');
  const isVolume = item.transformId.includes('volume') || item.metric === 'volume';

  // Semantic Title & Icon
  const titleText = isDrop
    ? '跌幅居前交易日'
    : isVolume
    ? '成交量最高交易日'
    : '涨幅居前交易日';

  const subtitleBadge = isDrop
    ? `最大跌幅 ${item.limit} 天`
    : isVolume
    ? `最高成交 ${item.limit} 天`
    : `最大涨幅 ${item.limit} 天`;

  const TitleIcon = isDrop ? TrendingDown : isVolume ? BarChart2 : TrendingUp;
  const iconColor = isDrop ? 'text-rose-400' : isVolume ? 'text-sky-400' : 'text-emerald-400';

  // Compute summary stats for the digital display board
  const values = item.points.map((p) => p.value);
  const peakVal = values.length > 0 ? (isDrop ? Math.min(...values) : Math.max(...values)) : 0;
  const avgVal = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const unit = item.points[0]?.unit;

  return (
    <div
      className={`rounded-xl border border-white/[0.08] bg-[#161C19] p-4.5 shadow-sm ${
        layout === 'sidebar' ? 'h-full flex flex-col justify-between' : ''
      }`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <TitleIcon className={`w-3.5 h-3.5 ${iconColor}`} />
            <h3 className="font-sans text-xs font-semibold tracking-tight text-[#F3F5F2]">
              {titleText}
            </h3>
          </div>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded tracking-wide ${
              isDrop
                ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                : isVolume
                ? 'bg-sky-950/60 text-sky-300 border border-sky-800/40'
                : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
            }`}
          >
            {subtitleBadge}
          </span>
        </div>

        {/* Clean Typographic & Interactive List */}
        <div className="space-y-2">
          {item.points.map((pt, idx) => {
            const isNegative = pt.value < 0;
            const isHovered = activeDate === pt.date;

            return (
              <div
                key={pt.date}
                onMouseEnter={() => onHoverDate?.(pt.date)}
                onMouseLeave={() => onHoverDate?.(null)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-150 cursor-pointer text-xs ${
                  isHovered
                    ? 'bg-[#222D28] border-white/20 ring-1 ring-emerald-500/30'
                    : 'bg-[#131916]/70 border-white/[0.04] hover:bg-[#1C2521] hover:border-white/[0.09]'
                }`}
              >
                {/* Index & Formatted Date */}
                <div className="flex items-center gap-2.5">
                  <span
                    className={`font-mono text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded ${
                      idx === 0
                        ? isDrop
                          ? 'bg-rose-600 text-white'
                          : isVolume
                          ? 'bg-sky-600 text-white'
                          : 'bg-emerald-600 text-white'
                        : 'bg-white/[0.08] text-[#8F9994]'
                    }`}
                  >
                    0{idx + 1}
                  </span>
                  <span className="font-mono text-xs text-[#F3F5F2] font-medium tracking-wide">
                    {pt.date}
                  </span>
                </div>

                {/* Precise Metric Value */}
                <span
                  className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                    unit === '%'
                      ? isNegative
                        ? 'bg-rose-950/70 text-rose-300 border border-rose-800/30'
                        : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/30'
                      : isVolume
                      ? 'bg-sky-950/70 text-sky-300 border border-sky-800/30'
                      : 'bg-white/[0.06] text-[#F3F5F2] border border-white/[0.08]'
                  }`}
                >
                  {formatMetricValue(pt.value, pt.unit)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quantitative Summary Footer */}
      <div className="mt-4 pt-3 border-t border-white/[0.07] flex items-center justify-between text-[11px] font-mono text-[#8F9994]">
        <div>
          <span>极值 </span>
          <span className="font-semibold text-[#F3F5F2]">
            {formatMetricValue(peakVal, unit)}
          </span>
        </div>
        <div>
          <span>前 {item.limit} 日均值 </span>
          <span className="font-semibold text-[#F3F5F2]">
            {formatMetricValue(avgVal, unit)}
          </span>
        </div>
      </div>
    </div>
  );
};

