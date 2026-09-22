# Requirements Matrix — Final

## Mandatory Requirements (from original problem statement)

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | NL input + ≥5 examples | PASS | AnalysisCommandBar.tsx: RESEARCH_EXAMPLES (G1-G5 + 2 failure) |
| 2 | NL → structured Schema | PASS | DeterministicInterpreter → compileInitialIntent → DashboardSpec |
| 3 | Schema fields: instrument, metrics, timeRange, chart type, title, dataSource, asOf, unit | PASS | DashboardSpec zod schema, CORE-03 benchmark 5/5 |
| 4 | ≥2 chart types + data conclusion | PASS | line (G1/G2/G5), bar (G1/G3/G4). All 5 have data-grounded insight |
| 5 | Follow-up modification | PASS | CORE-02: 5/5 follow-up via controller.submitCommand |
| 6 | Pipeline process status | PASS | PipelineEvent + controller.subscribe, CORE-06 |
| 7 | Error handling | PASS | CORE-07: 4 error types, DashboardRunFailure with code/message |
| 8 | Runnable Demo | PASS | npm run dev, Playwright UI-B01-B13 all pass |
| 9 | Mock data | PASS | src/data/mock-dataset.ts, MOCK.A/B, 80 trading days |
| 10 | ≥2 tests | PASS | 443 total (428 vitest + 15 Playwright) |
| 11 | Agent usage records | PASS | docs/agent-journal.md, README Agent section |
| 12 | Schema definition + examples | PASS | src/schema/dashboard-spec.ts, golden-cases.ts, README |
| 13 | README | PASS | Comprehensive README with all required sections |
| 14 | WenCai Skill Hub data | NOT_IMPLEMENTED | Schema enum exists, no provider. Documented honestly. |

## Status Summary

- PASS: 13
- NOT_IMPLEMENTED: 1 (WenCai — documented as not implemented)
- FAIL: 0

## Data-Grounded Conclusions

| Golden | insight.items | Type | Conclusion | Status |
|--------|--------------|------|------------|--------|
| G1 | 1 | rank | 涨跌幅 asc 3 (跌幅最大3天) | PASS |
| G2 | 1 | period_change | 收盘价区间变化 | PASS |
| G3 | 1 | rank | 涨跌幅 desc 3 (涨幅最大3天) | PASS |
| G4 | 1 | rank | 成交量 desc 5 (成交量最高5天) | PASS |
| G5 | 1 | period_change | 最高价区间变化 | PASS |
