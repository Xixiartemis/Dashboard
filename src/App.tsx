import React, { useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { AnalysisCommandBar } from './components/AnalysisCommandBar';
import { ResearchCanvas } from './components/ResearchCanvas';
import { AnalysisDetailsDrawer } from './components/AnalysisDetailsDrawer';
import { ErrorStateView } from './components/ErrorStateView';
import { EmptyStateView } from './components/EmptyStateView';
import { useDashboardRuntime } from './ui-runtime/use-dashboard-runtime';

export default function App() {
  const { state, submitCommand, reset } = useDashboardRuntime();

  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);

  const isSuccess = state.lastSuccess !== null && !state.latestError;
  const successResult = state.lastSuccess;
  const failureResult = state.latestError;
  const currentSpec = successResult?.spec ?? null;

  // Single Command Bar: controller auto-detects initial vs follow-up
  const handleCommandSubmit = useCallback(async (input: string) => {
    await submitCommand(input);
  }, [submitCommand]);

  // Example prompts go through the same runtime path
  const handleSelectExample = useCallback(async (prompt: string, _fixtureId: string) => {
    await submitCommand(prompt);
  }, [submitCommand]);

  // Reset entire dashboard
  const handleFullReset = useCallback(() => {
    reset();
    setIsDetailsOpen(false);
  }, [reset]);

  return (
    <div className="min-h-screen bg-[#F8F8F5] font-sans text-[#111815] antialiased selection:bg-stone-200">
      {/* ── 1. Global Navigation Bar ───────────────────────────────────────── */}
      <Navbar
        onReset={handleFullReset}
        hasActiveResult={state.commandContext === 'refine' || state.running}
        onOpenDetails={() => setIsDetailsOpen(true)}
        isDetailsAvailable={isSuccess || failureResult !== null}
      />

      {/* ── 2. Primary Workspace ─────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-6">
        {/* Persistent Analysis Command Bar (Single NLP Control Hub) */}
        <section aria-label="Analysis Command Hub">
          <AnalysisCommandBar
            onSubmit={handleCommandSubmit}
            onSelectExample={handleSelectExample}
            isLoading={state.running}
            currentSpec={currentSpec}
            activeInstrumentName={successResult?.provenance.instrument.displayName}
            activeInstrumentSymbol={successResult?.provenance.instrument.symbol}
            activeTimeRangeCount={successResult?.provenance.timeRange.count}
            isModified={state.commandContext === 'refine' && state.lastSuccess !== null}
          />
        </section>

        {/* ── 3. Research Canvas Views ─────────────────────────────────────── */}
        {/* Zero State View */}
        {state.commandContext === 'initial' && !state.running && !successResult && !failureResult && (
          <EmptyStateView onSelectPrompt={handleSelectExample} />
        )}

        {/* Success State: Continuous Research Canvas */}
        {successResult && (
          <ResearchCanvas
            result={successResult}
            onOpenDetails={() => setIsDetailsOpen(true)}
          />
        )}

        {/* Error State View (only when no previous dashboard) */}
        {failureResult && !successResult && (
          <ErrorStateView
            failure={failureResult}
            onRetry={() => {
              if (failureResult.input) {
                submitCommand(failureResult.input);
              }
            }}
            onSelectSample={() => {
              submitCommand('分析 A 公司最近 30 个交易日的收盘价和成交量，并标出跌幅最大的 3 个交易日。');
            }}
            onOpenDetails={() => setIsDetailsOpen(true)}
          />
        )}

        {/* Follow-up error: inline banner (preserves dashboard) */}
        {failureResult && successResult && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-xs">
            <span className="font-semibold">提示：</span>
            {failureResult.error.message}
          </div>
        )}
      </main>

      {/* ── 4. Unified Explainability & Details Drawer ───────────────────── */}
      <AnalysisDetailsDrawer
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        spec={currentSpec}
        provenance={successResult?.provenance}
        trace={state.pipeline}
        inputPrompt={successResult?.input ?? failureResult?.input ?? ''}
      />
    </div>
  );
}
