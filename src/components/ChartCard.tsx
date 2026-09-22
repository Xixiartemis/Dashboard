import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { DashboardChartResult } from '../application';

interface ChartCardProps {
  chart: DashboardChartResult;
  subtitle?: string;
  activeDate?: string | null;
  onHoverDate?: (date: string | null) => void;
  height?: number | string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  chart,
  subtitle,
  activeDate,
  onHoverDate,
  height = 290,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(containerRef.current, undefined, {
        renderer: 'canvas',
      });
    }

    const chartInstance = chartInstanceRef.current;

    // Enhance raw ECharts option with institutional dark canvas research aesthetics
    const rawOption = chart.option as any;
    const xCategories = (rawOption.xAxis?.data as string[]) || [];

    const enhancedSeries = (rawOption.series || []).map((s: any, idx: number) => {
      const isBar = s.type === 'bar';
      const isVolume = s.name?.includes('volume') || s.field?.includes('volume');
      const isPct = s.name?.includes('change_pct') || s.field?.includes('change_pct');
      const isMultiSeries = (rawOption.series || []).length > 1;

      // Extract highlighted indices from annotation markPoints if present (domain-grounded highlights)
      const highlightedIndices = new Set<number>();
      if (s.markPoint && Array.isArray(s.markPoint.data)) {
        s.markPoint.data.forEach((pt: any) => {
          if (pt.coord && typeof pt.coord[0] === 'number') {
            highlightedIndices.add(pt.coord[0]);
          }
        });
      }

      // Series colors for dark analytical canvas:
      // Multi-series lines (Open vs Close or High vs Low) get distinct high-contrast colors
      let seriesColor = '#34D399'; // Default Crisp Mint/Emerald for primary line
      if (isMultiSeries) {
        if (s.name?.includes('open') || s.field?.includes('open')) {
          seriesColor = '#60A5FA'; // Sky Blue for Open
        } else if (s.name?.includes('close') || s.field?.includes('close')) {
          seriesColor = '#34D399'; // Mint for Close
        } else if (s.name?.includes('high') || s.field?.includes('high')) {
          seriesColor = '#F59E0B'; // Amber for High
        } else if (s.name?.includes('low') || s.field?.includes('low')) {
          seriesColor = '#38BDF8'; // Sky Cyan for Low
        } else {
          seriesColor = idx === 0 ? '#60A5FA' : '#34D399';
        }
      }

      const seriesConfig: any = {
        ...s,
        itemStyle: {
          ...s.itemStyle,
          color: isPct && isBar
            ? (params: any) => {
                const val = typeof params.value === 'number' ? params.value : params.data;
                return val >= 0 ? '#10B981' : '#EF4444';
              }
            : isVolume
            ? (params: any) => {
                // Key volume days highlighted via domain annotation, regular days muted slate
                return highlightedIndices.has(params.dataIndex)
                  ? '#38BDF8'
                  : 'rgba(148, 163, 184, 0.28)';
              }
            : seriesColor,
          borderRadius: isPct && isBar
            ? (params: any) => {
                const val = typeof params.value === 'number' ? params.value : params.data;
                return val >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3];
              }
            : isBar
            ? [2, 2, 0, 0]
            : undefined,
        },
      };

      if (!isBar) {
        // STRICT RULE: Remove the 30 circle dots! Clean unbroken line.
        seriesConfig.showSymbol = false;
        seriesConfig.lineStyle = {
          ...s.lineStyle,
          width: 2.2,
          color: seriesColor,
        };
        // Subtle restrained area gradient for single line charts
        if (!isMultiSeries) {
          seriesConfig.areaStyle = {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(52, 211, 153, 0.12)' },
              { offset: 1, color: 'rgba(52, 211, 153, 0.00)' },
            ]),
          };
        }
      } else {
        seriesConfig.barMaxWidth = 22;
      }

      // If markPoint is present (Annotation for Top跌幅/涨幅/成交量), style as an institutional callout pill
      if (s.markPoint && Array.isArray(s.markPoint.data) && s.markPoint.data.length > 0) {
        const rawPoints = s.markPoint.data as any[];

        const isUpside = rawPoints.some(
          (d: any) =>
            d.name?.includes('涨') || (typeof d.value === 'number' && isPct && d.value > 0)
        );
        const isDownside = rawPoints.some(
          (d: any) =>
            d.name?.includes('跌') || (typeof d.value === 'number' && isPct && d.value < 0)
        );

        // Badge color aligned with institutional dark canvas tone
        const badgeColor = isUpside
          ? '#047857' // Deep Emerald for upside gain
          : isDownside
          ? '#DC2626' // Crimson for downside drop
          : '#0284C7'; // Sky Ocean Blue for volume

        // Stagger offsets for adjacent points so neighboring days never collide
        const enrichedPoints = rawPoints.map((pt: any) => {
          const xIdx = pt.coord?.[0];
          const hasAdjacentNeighbor = rawPoints.some(
            (other: any) =>
              other !== pt &&
              other.coord &&
              Math.abs(other.coord[0] - xIdx) === 1
          );

          let offset: [number, number] = [0, -14];
          if (hasAdjacentNeighbor) {
            const neighbor = rawPoints.find(
              (other: any) =>
                other !== pt &&
                other.coord &&
                Math.abs(other.coord[0] - xIdx) === 1
            );
            if (neighbor && typeof pt.value === 'number' && typeof neighbor.value === 'number') {
              offset = pt.value >= neighbor.value ? [0, -18] : [0, -10];
            }
          }

          return {
            ...pt,
            symbol: 'roundRect',
            symbolSize: isVolume ? [58, 22] : [54, 22],
            symbolOffset: offset,
          };
        });

        seriesConfig.markPoint = {
          ...s.markPoint,
          data: enrichedPoints,
          itemStyle: {
            color: badgeColor,
            borderColor: 'rgba(255, 255, 255, 0.4)',
            borderWidth: 1,
            shadowColor: 'rgba(0, 0, 0, 0.4)',
            shadowBlur: 6,
            shadowOffsetY: 2,
          },
          label: {
            fontSize: 10,
            fontFamily: 'ui-monospace, monospace',
            color: '#FFFFFF',
            fontWeight: 700,
            formatter: (params: any) => {
              if (typeof params.value === 'number') {
                if (isPct) {
                  return params.value > 0
                    ? `+${params.value.toFixed(2)}%`
                    : `${params.value.toFixed(2)}%`;
                }
                if (isVolume) {
                  // Fixed Volume format: compact "120.0万" so text never spills outside pill!
                  if (Math.abs(params.value) >= 10_000) {
                    return `${(params.value / 10_000).toFixed(1)}万`;
                  }
                  return `${params.value}`;
                }
                return `¥${params.value.toFixed(2)}`;
              }
              return params.value;
            },
          },
        };
      }

      return seriesConfig;
    });

    const isVolumeChart = (rawOption.series || []).some(
      (s: any) => s.name?.includes('volume') || s.field?.includes('volume')
    );
    const isPctChart = (rawOption.series || []).some(
      (s: any) => s.name?.includes('change_pct') || s.field?.includes('change_pct')
    );

    const formatYAxis = (axis: any) => ({
      ...axis,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.07)', // Institutional subtle grid line
          type: 'dashed' as const,
        },
      },
      axisLabel: {
        color: '#8F9994', // Institutional muted secondary
        fontSize: 10,
        fontFamily: 'ui-monospace, monospace',
        formatter: (val: number) => {
          if (isVolumeChart) {
            if (Math.abs(val) >= 100_000_000) {
              return `${(val / 100_000_000).toFixed(1)}亿`;
            }
            if (Math.abs(val) >= 10_000) {
              return `${(val / 10_000).toFixed(0)}万`;
            }
            return `${val}`;
          }
          if (isPctChart) {
            return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
          }
          return `¥${val.toFixed(1)}`;
        },
      },
      // Provide 22% headroom above the highest bar so markPoints never hit the canvas boundary
      max: (value: { max: number; min: number }) => {
        if (axis.max !== undefined) return axis.max;
        const span = Math.max(value.max - value.min, Math.abs(value.max) || 1);
        return Math.ceil((value.max + span * 0.22) * 100) / 100;
      },
      min: (value: { max: number; min: number }) => {
        if (axis.min !== undefined) return axis.min;
        const span = Math.max(value.max - value.min, Math.abs(value.min) || 1);
        return value.min < 0 ? Math.floor((value.min - span * 0.12) * 100) / 100 : 0;
      },
    });

    const enhancedYAxis = Array.isArray(rawOption.yAxis)
      ? rawOption.yAxis.map(formatYAxis)
      : rawOption.yAxis
      ? formatYAxis(rawOption.yAxis)
      : undefined;

    const refinedOption: echarts.EChartsOption = {
      ...rawOption,
      backgroundColor: 'transparent',
      // Remove redundant title inside canvas, dark canvas section header presents it cleanly
      title: { show: false },
      grid: {
        left: '2%',
        right: '3%',
        top: '16%', // Generous headroom preventing badge clipping
        bottom: '10%',
        containLabel: true,
      },
      xAxis: {
        ...rawOption.xAxis,
        axisLine: {
          lineStyle: { color: 'rgba(255, 255, 255, 0.12)' },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: '#8F9994',
          fontSize: 10,
          fontFamily: 'ui-monospace, monospace',
        },
      },
      yAxis: enhancedYAxis,
      series: enhancedSeries,
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: '#161C19',
        borderColor: 'rgba(255, 255, 255, 0.16)',
        borderRadius: 8,
        padding: [10, 14],
        textStyle: {
          color: '#F3F5F2',
          fontSize: 11,
          fontFamily: 'ui-monospace, monospace',
        },
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.25)',
            type: 'dashed',
            width: 1,
          },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const dateStr = params[0].axisValueLabel || params[0].name;
          const rows = params.map((p: any) => {
            const rawName = p.seriesName || '';
            const seriesName =
              rawName.includes('open') ? '开盘价'
              : rawName.includes('close') ? '收盘价'
              : rawName.includes('high') ? '最高价'
              : rawName.includes('low') ? '最低价'
              : rawName.includes('volume') ? '成交量'
              : rawName.includes('change_pct') ? '涨跌幅'
              : rawName;

            let valStr = '';
            if (typeof p.value === 'number') {
              if (isPctChart || rawName.includes('change_pct')) {
                valStr = `${p.value > 0 ? '+' : ''}${p.value.toFixed(2)}%`;
              } else if (isVolumeChart || rawName.includes('volume')) {
                valStr = p.value >= 10_000 ? `${(p.value / 10_000).toFixed(1)} 万股` : `${p.value} 股`;
              } else {
                valStr = `¥${p.value.toFixed(2)}`;
              }
            } else {
              valStr = `${p.value}`;
            }

            return `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 4px;">
                <span style="display: flex; align-items: center; gap: 6px; color: #8F9994;">
                  <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${p.color};"></span>
                  ${seriesName}
                </span>
                <span style="font-weight: 600; color: #F3F5F2;">${valStr}</span>
              </div>
            `;
          }).join('');

          return `
            <div style="min-width: 140px;">
              <div style="font-size: 10px; color: #8F9994; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                交易日期 · ${dateStr}
              </div>
              <div style="margin-top: 4px;">${rows}</div>
            </div>
          `;
        },
      },
    };

    chartInstance.setOption(refinedOption, true);

    // Synchronize hover event from chart to outside
    const handleShowTip = (params: any) => {
      if (params.dataIndex !== undefined && xCategories[params.dataIndex]) {
        onHoverDate?.(xCategories[params.dataIndex]);
      }
    };
    const handleHideTip = () => {
      onHoverDate?.(null);
    };

    chartInstance.on('showTip', handleShowTip);
    chartInstance.on('hideTip', handleHideTip);

    const resizeObserver = new ResizeObserver(() => {
      chartInstance.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      chartInstance.off('showTip', handleShowTip);
      chartInstance.off('hideTip', handleHideTip);
      resizeObserver.disconnect();
    };
  }, [chart.option, onHoverDate]);

  // Synchronize hover state from outside into ECharts
  useEffect(() => {
    const chartInstance = chartInstanceRef.current;
    if (!chartInstance) return;

    const rawOption = chart.option as any;
    const xCategories = (rawOption.xAxis?.data as string[]) || [];

    if (activeDate) {
      const idx = xCategories.indexOf(activeDate);
      if (idx >= 0) {
        chartInstance.dispatchAction({
          type: 'showTip',
          seriesIndex: 0,
          dataIndex: idx,
        });
        chartInstance.dispatchAction({
          type: 'highlight',
          seriesIndex: 0,
          dataIndex: idx,
        });
      }
    } else {
      chartInstance.dispatchAction({
        type: 'hideTip',
      });
      chartInstance.dispatchAction({
        type: 'downplay',
        seriesIndex: 0,
      });
    }
  }, [activeDate, chart.option]);

  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // Multi-series legend helpers
  const rawSeries = (chart.option as any).series || [];
  const hasMultipleSeries = rawSeries.length > 1;

  // Determine metric tag and unit
  const isVolume = rawSeries.some((s: any) => s.name?.includes('volume') || s.field?.includes('volume'));
  const isPct = rawSeries.some((s: any) => s.name?.includes('change_pct') || s.field?.includes('change_pct'));
  const metricCategory = isVolume ? '成交量' : isPct ? '涨跌幅' : '价格走势';
  const unitLabel = isVolume ? '单位：万股' : isPct ? '单位：%' : '单位：元';

  return (
    <div className="flex flex-col bg-[#161C19] rounded-xl border border-white/[0.08] p-4 shadow-sm h-full">
      {/* Editorial Header inside Dark Stage */}
      <div className="flex items-center justify-between border-b border-white/[0.07] pb-2.5 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 uppercase">
            {metricCategory}
          </span>
          <h3 className="font-sans text-xs font-semibold tracking-tight text-[#F3F5F2]">
            {chart.title}
          </h3>
          {subtitle && (
            <span className="text-[11px] text-[#8F9994] font-normal">
              {subtitle}
            </span>
          )}
        </div>

        {/* Right side: Multi-series Legend or Unit Badge */}
        <div className="flex items-center gap-3">
          {hasMultipleSeries ? (
            <div className="flex items-center gap-2.5 text-[11px] font-mono">
              {rawSeries.map((s: any, idx: number) => {
                const color =
                  s.name?.includes('open') || s.field?.includes('open')
                    ? '#60A5FA'
                    : s.name?.includes('close') || s.field?.includes('close')
                    ? '#34D399'
                    : s.name?.includes('high') || s.field?.includes('high')
                    ? '#F59E0B'
                    : s.name?.includes('low') || s.field?.includes('low')
                    ? '#38BDF8'
                    : idx === 0
                    ? '#60A5FA'
                    : '#34D399';
                const label =
                  s.name?.includes('open') || s.field?.includes('open')
                    ? '开盘价'
                    : s.name?.includes('close') || s.field?.includes('close')
                    ? '收盘价'
                    : s.name?.includes('high') || s.field?.includes('high')
                    ? '最高价'
                    : s.name?.includes('low') || s.field?.includes('low')
                    ? '最低价'
                    : s.name || `Series ${idx + 1}`;
                return (
                  <div key={idx} className="flex items-center gap-1.5 text-[#8F9994]">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: color }}
                    />
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="font-mono text-[10px] text-[#8F9994] uppercase">
              {unitLabel}
            </span>
          )}
        </div>
      </div>

      {/* ECharts Canvas Container */}
      <div
        ref={containerRef}
        className="w-full flex-1 min-h-[240px]"
        style={{ height }}
        id={`chart-container-${chart.viewId}`}
      />
    </div>
  );
};

