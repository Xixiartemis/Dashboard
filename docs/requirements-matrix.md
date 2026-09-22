# Requirements Matrix — Final

## Mandatory Requirements (from original problem statement)

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | NL input + ≥5 examples | PASS | AnalysisCommandBar.tsx: RESEARCH_EXAMPLES (G1-G5 + 2 failure) |
| 2 | NL → structured Schema | PASS | DeterministicInterpreter → compileInitialIntent → DashboardSpec |
| 3 | Schema fields: instrument, metrics, timeRange, chart type, title, dataSource, asOf, unit | PASS | DashboardSpec zod schema, CORE-03 benchmark |
| 4 | ≥2 chart types + data conclusion | PASS | line (G1/G2/G5), bar (G1/G3/G4). G1/G3/G4 have rank insight |
| 5 | Follow-up modification | PASS | CORE-02: 5/5 follow-up via controller.submitCommand |
| 6 | Pipeline process status | PASS | PipelineEvent + controller.subscribe, CORE-06 |
| 7 | Error handling | PASS | CORE-07: 4 error types, DashboardRunFailure with code/message |
| 8 | Runnable Demo | PASS | npm run dev, Playwright UI-B01-B13 |
| 9 | Mock data | PASS | src/data/mock-dataset.ts, MOCK.A/B |
| 10 | ≥2 tests | PASS | 428 unit + 15 browser = 443 total |
| 11 | Agent usage records | PARTIAL | docs/agent-journal.md (structured, not raw conversation) |
| 12 | Schema definition + examples | PASS | src/schema/dashboard-spec.ts, golden-cases.ts |
| 13 | README | FAIL | Still Vite template |
| 14 | WenCai Skill Hub data | NOT_IMPLEMENTED | Schema enum exists, no provider |

## Status Summary

- PASS: 10
- PARTIAL: 2 (agent logs, data conclusions for G2/G5)
- FAIL: 1 (README)
- NOT_IMPLEMENTED: 1 (WenCai)
