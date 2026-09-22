# Submission Acceptance Benchmark

Generated: 2026-09-22
Base: 01202a1 (integration/final-demo)

## A. Requirements Coverage

| # | Requirement | Status | Code Evidence | Core Benchmark | Browser Benchmark |
|---|-------------|--------|---------------|----------------|-------------------|
| 1 | NL input + ≥5 examples | PASS | AnalysisCommandBar.tsx (RESEARCH_EXAMPLES) | CORE-01 | UI-B01 |
| 2 | NL → structured Schema | PASS | interpreter/*, runtime/* | CORE-01, CORE-02 | UI-B02-B08 |
| 3 | Schema: instrument, metrics, timeRange, chart type, title, dataSource, asOf, unit | PASS | DashboardSpec zod schema, CORE-03 test | CORE-03 | UI-B02 |
| 4 | ≥2 chart types (line + bar) + data conclusion | PASS | CORE-04 (line+bar), CORE-05 (insight items) | CORE-04, CORE-05 | UI-B02 (G1=line+bar) |
| 5 | Follow-up modification | PASS | controller.submitCommand auto follow-up | CORE-02 | UI-B04-B08 |
| 6 | Pipeline process status | PASS | PipelineEvent + subscribe | CORE-06 | UI-B11 |
| 7 | Error handling (invalid schema, missing metric, empty data) | PASS | interpreterFailure + extractErrorInfo | CORE-07 | UI-B09, UI-B10 |
| 8 | Runnable local Demo | PASS | npm run dev / npm run build | — | All UI-B tests |
| 9 | Built-in mock data | PASS | src/data/mock-dataset.ts | All CORE | All UI-B |
| 10 | ≥2 tests (normal + schema failure) | PASS | 428+ tests total | CORE-01 to CORE-08 | 15 Playwright |
| 11 | Agent tool usage records | PARTIAL | docs/agent-journal.md exists | — | — |
| 12 | Schema definition + examples | PASS | src/schema/dashboard-spec.ts, docs/ui-handoff-contract.md | — | — |
| 13 | README: startup, architecture, data, limitations | FAIL | README.md is Vite template | — | — |
| 14 | WenCai Skill Hub data | NOT_IMPLEMENTED | dataSource.preference has 'wencai' enum but no provider | — | — |

## B. Core Benchmark Results

| Test | Description | Result |
|------|-------------|--------|
| CORE-01 | G1-G5 initial full pipeline | 5/5 PASS |
| CORE-02 | G1-G5 follow-up full pipeline | 5/5 PASS |
| CORE-03 | Schema required fields | 5/5 PASS |
| CORE-04 | Line + bar chart types | PASS (line in G1/G2/G5, bar in G1/G3/G4) |
| CORE-05 | Data-grounded conclusions | see below |
| CORE-06 | Pipeline sequence | PASS |
| CORE-07 | Error handling (4 cases) | 4/4 PASS |
| CORE-08 | Determinism (3x G1-G5) | 5/5 PASS (0 non-deterministic) |

### CORE-05 Data Conclusions Detail

| Golden | insight.items | Type | Conclusion | Status |
|--------|--------------|------|------------|--------|
| G1 | 1 | rank | 涨跌幅 asc 3 points (跌幅最大3天) | PASS |
| G2 | 0 | — | Only intentSummary (no data-grounded conclusion) | PARTIAL |
| G3 | 1 | rank | 涨跌幅 desc 3 points (涨幅最大3天) | PASS |
| G4 | 1 | rank | 成交量 desc 5 points (成交量最高5天) | PASS |
| G5 | 0 | — | Only intentSummary (no data-grounded conclusion) | PARTIAL |

G2 and G5 have no ranking transforms (they don't ask for ranking). Their insight only contains intentSummary. The original requirement says "展示一条与图表数据一致的简短结论" — G2/G5's intentSummary restates the analysis goal but doesn't contain a data-derived conclusion. This is a known gap: the analytics engine doesn't produce period_change insight for non-ranking cases.

## C. Browser Benchmark Results

| Test | Description | Result | Screenshot |
|------|-------------|--------|------------|
| UI-B01 | Zero State | PASS | 01-zero-state.png |
| UI-B02 | G1 Initial | PASS | 02-g1-initial.png |
| UI-B03 | G1 Ranking | PASS | 03-g1-ranking.png |
| UI-B04 | G1 Follow-up | PASS | 04-g1-followup.png |
| UI-B05 | G2 Flow | PASS | 05-g2-flow.png |
| UI-B06 | G3 Flow | PASS | 06-g3-flow.png |
| UI-B07 | G4 Flow | PASS | 07-g4-flow.png |
| UI-B08 | G5 Flow | PASS | 08-g5-flow.png |
| UI-B09 | Initial Error | PASS | 09-initial-error.png |
| UI-B10 | Follow-up Error Preserves | PASS | 10-followup-error.png |
| UI-B11 | Explainability | PASS | 11-explainability.png |
| UI-B12 | Reset | PASS | — |
| UI-B13 | Responsive 1440 | PASS | 13-responsive-1440.png |
| UI-B13 | Responsive 1280 | PASS | 13-responsive-1280.png |
| UI-B13 | Responsive 768 | PASS | 13-responsive-768.png |

UNCAUGHT_PAGE_ERRORS=0 (no React console errors detected)

## D. Interpreter Eval (Block 3 Reference)

| Metric | Value |
|--------|-------|
| Corpus total | 73 cases (60 DEV + 13 HOLDOUT) |
| Final DEV | 60/60 |
| Final HOLDOUT | 13/13 |
| FALSE_ACCEPT | 0 |
| FALSE_REJECT | 0 |
| Determinism | 0 non-deterministic |

Full report: docs/interpreter-eval-report.md

## E. Known Failures & Gaps

### MANDATORY GAPS

| # | Gap | Impact | Fix Required |
|---|-----|--------|-------------|
| M1 | README is Vite template | Submission requirement not met | YES — write proper README |
| M2 | G2/G5 no data-grounded conclusion | "展示一条与图表数据一致的简短结论" not fully met | Evaluate — add period_change to analytics or document as limitation |

### OPTIONAL GAPS

| # | Gap | Impact |
|---|-----|--------|
| O1 | WenCai Skill Hub not implemented | Original requirement #1 ("优先通过问财") |
| O2 | Raw agent conversation log not in repo | Only structured journal exists |
| O3 | Execution replay animation not implemented | UI enhancement only |

## F. Technical Audit

### WenCai Status
- WENCAI_SCHEMA_PREFERENCE=YES (enum value 'wencai' exists in DashboardSpec)
- WENCAI_PROVIDER_IMPLEMENTED=NO
- WENCAI_RUNTIME_USED=NO
- WENCAI_FALLBACK_IMPLEMENTED=NO

### AI/Agent Status
- LLM_USED=NO
- DETERMINISTIC_AGENT_USED=YES (DeterministicInterpreter)
- REPRODUCIBLE=YES (determinism verified)
- OPTIONAL_LLM_EXTRACTOR_FEASIBILITY=HIGH (interpreter architecture supports swapping Extractor)

### Agent Log Status
- AGENT_JOURNAL_EXISTS=YES (docs/agent-journal.md)
- RAW_AGENT_LOG_EXISTS=NO
- AGENT_LOG_REQUIREMENT=PARTIAL

### Execution Replay Feasibility
- EXECUTION_REPLAY_FEASIBILITY=HIGH
- The DashboardRunResult.trace contains step-by-step timing data
- A pure presentation animation (300-500ms per step) using existing trace data would not require any Runtime changes

## G. Test Summary

| Suite | Tests | Pass |
|-------|-------|------|
| Unit/Integration (vitest) | 428 | 428 |
| Playwright Browser | 15 | 15 |
| **Total** | **443** | **443** |

TYPECHECK=PASS
LINT=PASS
BUILD=PASS
