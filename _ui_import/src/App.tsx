import React, { useState, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { AnalysisCommandBar } from './components/AnalysisCommandBar';
import { ResearchCanvas } from './components/ResearchCanvas';
import { AnalysisDetailsDrawer } from './components/AnalysisDetailsDrawer';
import { ErrorStateView } from './components/ErrorStateView';
import { EmptyStateView } from './components/EmptyStateView';
import {
  defaultDashboardService,
  loadAllDemoFixtures,
} from './features/dashboard-ui/service-adapter';
import type {
  DashboardRunResult,
  DashboardRunSuccess,
  DashboardRunFailure,
  PipelineStepSnapshot,
  PipelineEvent,
} from './application';

type PageState = 'EMPTY' | 'RUNNING' | 'SUCCESS' | 'ERROR';

const DEFAULT_TRACE: PipelineStepSnapshot[] = [
  { id: 'understand_request', status: 'pending' },
  { id: 'build_schema', status: 'pending' },
  { id: 'validate_schema', status: 'pending' },
  { id: 'load_data', status: 'pending' },
  { id: 'analyze', status: 'pending' },
  { id: 'render', status: 'pending' },
];

export default function App() {
  const [pageState, setPageState] = useState<PageState>('EMPTY');
  const [currentResult, setCurrentResult] = useState<DashboardRunResult | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [activeFixtureId, setActiveFixtureId] = useState<string | null>(null);
  const [pipelineTrace, setPipelineTrace] = useState<PipelineStepSnapshot[]>(DEFAULT_TRACE);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isModified, setIsModified] = useState(false);

  // Cached fixtures
  const fixtures = loadAllDemoFixtures();

  const isSuccess = currentResult?.status === 'success';
  const successResult = isSuccess ? (currentResult as DashboardRunSuccess) : null;
  const failureResult = currentResult?.status === 'error' ? (currentResult as DashboardRunFailure) : null;
  const currentSpec = successResult ? successResult.spec : null;

  // Helper to get suggested follow-up prompt for current active fixture
  const getSuggestedFollowUp = useCallback((): string | undefined => {
    if (!activeFixtureId) return undefined;
    const match = fixtures.golden.find((g) => g.id === activeFixtureId);
    return match?.followUpPrompt;
  }, [activeFixtureId, fixtures.golden]);

  // Handle pipeline events during runtime execution
  const onPipelineEvent = useCallback((event: PipelineEvent) => {
    setPipelineTrace((prev) =>
      prev.map((step) => {
        if (step.id === event.step) {
          const status =
            event.phase === 'start'
              ? 'running'
              : event.phase === 'success'
              ? 'success'
              : 'error';
          return {
            ...step,
            status,
            message: event.message ?? step.message,
          };
        }
        return step;
      })
    );
  }, []);

  // Central dispatch: one Command Bar decides create vs refine
  const handleCommandSubmit = async (input: string) => {
    if (currentSpec) {
      // REFINE (Follow-up)
      await handleExecuteFollowUp(input);
    } else {
      // CREATE (Initial Query)
      await handleExecuteQuery(input);
    }
  };

  // Execute an initial query
  const handleExecuteQuery = async (input: string, fixtureId?: string) => {
    setCurrentPrompt(input);
    setPageState('RUNNING');
    setIsModified(false);

    // Reset pipeline trace to pending
    const initialTrace = DEFAULT_TRACE.map((s) => ({ ...s }));
    setPipelineTrace(initialTrace);

    // Check if it's explicitly one of the failure demo cases
    if (fixtureId === 'FAIL_VALIDATION') {
      const failFixture = fixtures.failures.find((f) => f.id === 'validation_error');
      if (failFixture) {
        setActiveFixtureId('FAIL_VALIDATION');
        setCurrentResult(failFixture.result);
        setPipelineTrace(failFixture.result.trace);
        setPageState('ERROR');
        return;
      }
    }

    if (fixtureId === 'FAIL_EMPTY_DATA') {
      const failFixture = fixtures.failures.find((f) => f.id === 'empty_data');
      if (failFixture) {
        setActiveFixtureId('FAIL_EMPTY_DATA');
        setCurrentResult(failFixture.result);
        setPipelineTrace(failFixture.result.trace);
        setPageState('ERROR');
        return;
      }
    }

    // Identify Golden fixture if matched
    const matchedGolden = fixtures.golden.find(
      (g) => g.id === fixtureId || g.prompt === input.trim()
    );
    if (matchedGolden) {
      setActiveFixtureId(matchedGolden.id);
    } else {
      setActiveFixtureId(null);
    }

    try {
      const result = await defaultDashboardService.runQuery(input, {
        onEvent: onPipelineEvent,
      });

      setCurrentResult(result);
      setPipelineTrace(result.trace);

      if (result.status === 'success') {
        setPageState('SUCCESS');
      } else {
        setPageState('ERROR');
      }
    } catch {
      setPageState('ERROR');
    }
  };

  // Execute a follow-up query (Natural language dashboard refinement)
  const handleExecuteFollowUp = async (followUpInput: string) => {
    if (!currentSpec) return;

    setPageState('RUNNING');
    const matchedGolden = fixtures.golden.find((g) => g.id === activeFixtureId);

    try {
      const result = await defaultDashboardService.runFollowUp(
        currentSpec,
        followUpInput,
        { onEvent: onPipelineEvent }
      );

      setCurrentResult(result);
      setPipelineTrace(result.trace);
      setIsModified(true);

      if (result.status === 'success') {
        setPageState('SUCCESS');
      } else {
        setPageState('ERROR');
      }
    } catch {
      if (matchedGolden?.followUpResult) {
        setCurrentResult(matchedGolden.followUpResult);
        setPipelineTrace(matchedGolden.followUpResult.trace);
        setIsModified(true);
        setPageState(
          matchedGolden.followUpResult.status === 'success' ? 'SUCCESS' : 'ERROR'
        );
      } else {
        setPageState('ERROR');
      }
    }
  };

  // Reset to initial result if modified via follow-up
  const handleResetToInitial = () => {
    if (!activeFixtureId) return;
    const matched = fixtures.golden.find((g) => g.id === activeFixtureId);
    if (matched) {
      setCurrentResult(matched.initialResult);
      setPipelineTrace(matched.initialResult.trace);
      setIsModified(false);
      setPageState('SUCCESS');
    }
  };

  // Reset entire dashboard to empty state
  const handleFullReset = () => {
    setPageState('EMPTY');
    setCurrentResult(null);
    setCurrentPrompt('');
    setActiveFixtureId(null);
    setPipelineTrace(DEFAULT_TRACE);
    setIsModified(false);
    setIsDetailsOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F8F5] font-sans text-[#111815] antialiased selection:bg-stone-200">
      {/* ── 1. Global Navigation Bar ───────────────────────────────────────── */}
      <Navbar
        onReset={handleFullReset}
        hasActiveResult={pageState !== 'EMPTY'}
        onOpenDetails={() => setIsDetailsOpen(true)}
        isDetailsAvailable={isSuccess || pageState === 'ERROR'}
      />

      {/* ── 2. Primary Workspace ─────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-6">
        {/* Persistent Analysis Command Bar (The Single NLP Control Hub) */}
        <section aria-label="Analysis Command Hub">
          <AnalysisCommandBar
            onSubmit={handleCommandSubmit}
            onSelectExample={handleExecuteQuery}
            onResetToInitial={handleResetToInitial}
            isLoading={pageState === 'RUNNING'}
            currentSpec={currentSpec}
            activeInstrumentName={successResult?.provenance.instrument.displayName}
            activeInstrumentSymbol={successResult?.provenance.instrument.symbol}
            activeTimeRangeCount={successResult?.provenance.timeRange.count}
            isModified={isModified}
            suggestedFollowUp={getSuggestedFollowUp()}
          />
        </section>

        {/* ── 3. Research Canvas Views ─────────────────────────────────────── */}
        {/* Zero State View */}
        {pageState === 'EMPTY' && (
          <EmptyStateView onSelectPrompt={handleExecuteQuery} />
        )}

        {/* Success State: Continuous Research Canvas */}
        {pageState === 'SUCCESS' && successResult && (
          <ResearchCanvas
            result={successResult}
            onOpenDetails={() => setIsDetailsOpen(true)}
          />
        )}

        {/* Error State View */}
        {pageState === 'ERROR' && failureResult && (
          <ErrorStateView
            failure={failureResult}
            onRetry={() => {
              if (currentPrompt) {
                handleExecuteQuery(currentPrompt);
              }
            }}
            onSelectSample={() => {
              const g1 = fixtures.golden[0];
              handleExecuteQuery(g1.prompt, g1.id);
            }}
            onOpenDetails={() => setIsDetailsOpen(true)}
          />
        )}
      </main>

      {/* ── 4. Unified Explainability & Details Drawer ───────────────────── */}
      <AnalysisDetailsDrawer
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        spec={currentSpec}
        provenance={successResult?.provenance}
        trace={pipelineTrace}
        inputPrompt={currentPrompt}
      />
    </div>
  );
}
