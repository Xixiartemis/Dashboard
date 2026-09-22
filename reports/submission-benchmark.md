# Submission Acceptance Benchmark — Final

Generated: 2026-09-22
Base: 83db263 → Final: (pending commit)

## A. Requirements Coverage

| # | Requirement | Status |
|---|-------------|--------|
| 1 | NL input + ≥5 examples | PASS |
| 2 | NL → structured Schema | PASS |
| 3 | Schema required fields | PASS |
| 4 | ≥2 chart types + data conclusion | PASS |
| 5 | Follow-up modification | PASS |
| 6 | Pipeline process status | PASS |
| 7 | Error handling | PASS |
| 8 | Runnable Demo | PASS |
| 9 | Mock data | PASS |
| 10 | ≥2 tests | PASS (443 total) |
| 11 | Agent usage records | PASS |
| 12 | Schema definition + examples | PASS |
| 13 | README | PASS |
| 14 | WenCai | NOT_IMPLEMENTED (documented) |

PASS: 13/14, NOT_IMPLEMENTED: 1 (WenCai)

## B. Core Benchmark (33/33)

| Test | Result |
|------|--------|
| CORE-01: G1-G5 initial | 5/5 |
| CORE-02: G1-G5 follow-up | 5/5 |
| CORE-03: Schema fields | 5/5 |
| CORE-04: line + bar | PASS |
| CORE-05: Data conclusions | 5/5 (all have ≥1 data-grounded insight) |
| CORE-06: Pipeline sequence | PASS |
| CORE-07: Error handling | 4/4 |
| CORE-08: Determinism | 5/5 |

## C. Browser Benchmark (15/15)

All UI-B01 through UI-B13 pass. 0 console errors. Screenshots in reports/ui-benchmark/.

## D. Data Conclusions Detail

| Golden | Type | Metric | Conclusion |
|--------|------|--------|------------|
| G1 | rank | 涨跌幅 | 跌幅最大3天 (asc 3) |
| G2 | period_change | 收盘价 | 区间起止变化 |
| G3 | rank | 涨跌幅 | 涨幅最大3天 (desc 3) |
| G4 | rank | 成交量 | 成交量最高5天 (desc 5) |
| G5 | period_change | 最高价 | 区间起止变化 |

Policy: no rankings → auto-select primary metric (close > open > high > low) for period_change. Generic, not per-golden.

## E. Interpreter Eval (reference)

73 cases (60 DEV + 13 HOLDOUT), FALSE_ACCEPT=0, FALSE_REJECT=0. See docs/interpreter-eval-report.md.

## F. Known Limitations

1. Limited Chinese language patterns
2. No real market data
3. WenCai not implemented
4. Line/bar only
5. Single timeRange/mark
6. Mock calendar (weekdays only)
7. No investment advice
