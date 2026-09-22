import React from 'react';
import type { DashboardRunFailure } from '../application';
import { AlertCircle, Database, RotateCcw, ArrowRight, FileText } from 'lucide-react';

interface ErrorStateViewProps {
  failure: DashboardRunFailure;
  onRetry: () => void;
  onSelectSample: () => void;
  onOpenDetails: () => void;
}

export const ErrorStateView: React.FC<ErrorStateViewProps> = ({
  failure,
  onRetry,
  onSelectSample,
  onOpenDetails,
}) => {
  const { error, stage, input } = failure;
  const isEmptyData = stage === 'load_data' || error.code === 'EMPTY_DATA';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 py-4">
      {/* Product-grade clean feedback card */}
      <div className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              isEmptyData
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {isEmptyData ? (
              <Database className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  isEmptyData
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-rose-100 text-rose-900'
                }`}
              >
                {isEmptyData ? '数据可用性限制' : '规则校验未通过'}
              </span>
              <span className="text-xs text-stone-500">
                中断环节：{stage === 'understand_request' ? '意图理解'
                  : stage === 'build_schema' ? '构建规范'
                  : stage === 'validate_schema' ? '规则校验'
                  : stage === 'load_data' ? '读取数据'
                  : stage === 'analyze' ? '时序计算'
                  : stage === 'render' ? '画布装配'
                  : stage}
              </span>
            </div>

            <h3 className="font-serif text-lg font-bold text-stone-900">
              {isEmptyData
                ? '请求意图和规范均合法，但在所选时间区间内无有效时序数据'
                : error.message}
            </h3>

            <p className="text-xs text-stone-600 font-sans leading-relaxed">
              {isEmptyData ? (
                <>
                  流水线已成功执行「需求理解」与「规范校验」，但在读取交易时序时未检索到有效历史记录。系统已安全短路，避免渲染空图表。
                </>
              ) : (
                <>
                  输入在「规则校验」阶段发现不符合金融时序约束（如标的代码未在资产注册表中）。可修改查询指令后重新分析。
                </>
              )}
            </p>

            {/* Input Echo */}
            <div className="rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-600 border border-stone-200/60 inline-block font-sans">
              触发指令："{input}"
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#111815] px-3.5 py-1.5 text-xs font-semibold text-stone-100 shadow-xs hover:bg-stone-800 transition cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>修改输入重试</span>
              </button>

              <button
                type="button"
                onClick={onSelectSample}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition shadow-2xs cursor-pointer"
              >
                <span>体验标准用例（G1 收盘价与成交量）</span>
                <ArrowRight className="h-3 w-3" />
              </button>

              <button
                type="button"
                onClick={onOpenDetails}
                className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition ml-auto cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>查看执行流水线追踪</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
