import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  FileCode,
  Activity,
  Database,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { DashboardSpec } from '../schema/dashboard-spec';
import type { PipelineStepSnapshot, DashboardDataProvenance } from '../application';

interface AnalysisDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  spec: DashboardSpec | null;
  provenance?: DashboardDataProvenance;
  trace: PipelineStepSnapshot[];
  inputPrompt?: string;
}

type TabKey = 'schema' | 'execution' | 'provenance' | 'overview';

export const AnalysisDetailsDrawer: React.FC<AnalysisDetailsDrawerProps> = ({
  isOpen,
  onClose,
  spec,
  provenance,
  trace,
  inputPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('schema');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const jsonString = spec ? JSON.stringify(spec, null, 2) : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Syntax highlighting parser
  const renderHighlightedJson = (json: string) => {
    const tokenRegex =
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = tokenRegex.exec(json)) !== null) {
      if (match.index > lastIndex) {
        parts.push(json.slice(lastIndex, match.index));
      }

      const token = match[0];
      if (/^"/.test(token)) {
        if (/:$/.test(token)) {
          // Key
          parts.push(
            <span key={match.index} className="text-stone-900 font-semibold">
              {token}
            </span>
          );
        } else {
          // String value
          parts.push(
            <span key={match.index} className="text-emerald-700">
              {token}
            </span>
          );
        }
      } else if (/true|false/.test(token)) {
        // Boolean
        parts.push(
          <span key={match.index} className="text-amber-700 font-semibold">
            {token}
          </span>
        );
      } else if (/null/.test(token)) {
        // Null
        parts.push(
          <span key={match.index} className="text-stone-400 italic">
            {token}
          </span>
        );
      } else {
        // Number
        parts.push(
          <span key={match.index} className="text-blue-700 font-mono">
            {token}
          </span>
        );
      }

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < json.length) {
      parts.push(json.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/30 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-[#FDFDFC] shadow-2xl border-l border-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200/90 px-6 py-4 bg-[#FAF9F5]">
          <div>
            <h2 className="font-serif text-lg font-bold text-stone-900">
              分析链路与技术溯源
            </h2>
            <p className="text-xs text-stone-500 font-mono">
              确定性分析规范与可信执行详情
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200/90 px-6 bg-white text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('schema')}
            className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'schema'
                ? 'border-[#111815] text-[#111815]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>结构化规范 (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('execution')}
            className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'execution'
                ? 'border-[#111815] text-[#111815]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>执行链路 ({trace.filter((s) => s.status === 'success').length}/6)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('provenance')}
            className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'provenance'
                ? 'border-[#111815] text-[#111815]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>数据源溯源</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-medium transition cursor-pointer ${
              activeTab === 'overview'
                ? 'border-[#111815] text-[#111815]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Info className="h-3.5 w-3.5" />
            <span>研究概览</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: SCHEMA */}
          {activeTab === 'schema' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-stone-500 text-[11px]">
                  规范版本：1.0.0 · 数据源：内置仿真数据集
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 transition shadow-2xs cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-700">已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>复制规范</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-stone-200 bg-[#FBFBFA] p-4 overflow-x-auto text-[11px] font-mono leading-relaxed text-stone-800">
                <pre>{renderHighlightedJson(jsonString)}</pre>
              </div>
            </div>
          )}

          {/* TAB 2: EXECUTION TRACE */}
          {activeTab === 'execution' && (
            <div className="space-y-4">
              <div className="font-mono text-xs text-stone-500 pb-2 border-b border-stone-100">
                严密 6 步投研执行流水线追踪
              </div>

              <div className="space-y-2.5">
                {trace.map((step, idx) => (
                  <div
                    key={step.id}
                    className="rounded-lg border border-stone-200 bg-white p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-stone-400">
                          0{idx + 1}
                        </span>
                        <span className="font-mono font-bold text-stone-800">
                          {step.id === 'understand_request' ? '意图理解 (understand_request)'
                            : step.id === 'build_schema' ? '构建规范 (build_schema)'
                            : step.id === 'validate_schema' ? '规则校验 (validate_schema)'
                            : step.id === 'load_data' ? '读取数据 (load_data)'
                            : step.id === 'analyze' ? '时序计算 (analyze)'
                            : step.id === 'render' ? '画布装配 (render)'
                            : step.id}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                          step.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : step.status === 'error'
                            ? 'bg-rose-50 text-rose-700'
                            : step.status === 'running'
                            ? 'bg-blue-50 text-blue-700 animate-pulse'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {step.status === 'success' && (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {step.status === 'error' && (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        {step.status === 'running' && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        <span>
                          {step.status === 'success' ? '成功'
                            : step.status === 'error' ? '失败'
                            : step.status === 'running' ? '执行中'
                            : step.status === 'skipped' ? '已跳过'
                            : '等待'}
                        </span>
                      </span>
                    </div>

                    {step.message && (
                      <div className="font-mono text-[11px] text-stone-600 bg-stone-50 p-2 rounded border border-stone-100">
                        {step.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DATA PROVENANCE */}
          {activeTab === 'provenance' && provenance && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
                <div className="font-sans font-bold text-stone-900 border-b border-stone-100 pb-2 text-sm">
                  标的资产与数据集清单
                </div>
                <div className="grid grid-cols-2 gap-3 text-stone-600 font-mono">
                  <div>
                    <span className="text-stone-400 block text-[10px]">数据集标识</span>
                    <strong className="text-stone-800">{provenance.datasetId}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">交易日历</span>
                    <strong className="text-stone-800">{provenance.calendar}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">时区标准</span>
                    <strong className="text-stone-800">{provenance.timezone}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">时间跨度</span>
                    <strong className="text-stone-800">
                      最近 {provenance.timeRange.count} 个交易日 ({provenance.timeRange.basis})
                    </strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">基准日期</span>
                    <strong className="text-stone-800">{provenance.asOf}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">分析标的</span>
                    <strong className="text-stone-800">
                      {provenance.instrument.displayName} ({provenance.instrument.symbol})
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OVERVIEW */}
          {activeTab === 'overview' && spec && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
                <div className="font-sans font-bold text-stone-900 border-b border-stone-100 pb-2 text-sm">
                  投研分析总览
                </div>
                {inputPrompt && (
                  <div>
                    <span className="text-[10px] text-stone-400 block">
                      自然语言输入指令
                    </span>
                    <p className="font-medium text-stone-800 mt-1 italic">
                      "{inputPrompt}"
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 pt-2 text-stone-600">
                  <div>
                    <span className="text-stone-400 block text-[10px]">分析跨度</span>
                    <strong className="text-stone-800 text-sm font-mono">
                      {spec.timeRange.count} 个交易日
                    </strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">视图数量</span>
                    <strong className="text-stone-800 text-sm font-mono">
                      {spec.views.length} 个图表
                    </strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">计算规则</span>
                    <strong className="text-stone-800 text-sm font-mono">
                      {spec.transforms.length} 项时序规则
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
