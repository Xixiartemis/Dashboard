# Schema Freeze Report — DashboardSpec v1.0

## Gate 验证结果

```
DATASET_INVARIANTS=PASS
  MOCK.A: 80 trading days, all invariants satisfied
  MOCK.B: 80 trading days, all invariants satisfied
  Coverage: 80 >= 61 (60 max query + 1 lookback)
  asOf consistency: 2025-12-31 matches manifest

INSTRUMENT_REGISTRY=PASS
  MOCK.A: equity, A公司, 4 aliases
  MOCK.B: equity, B公司, 4 aliases
  2/2 instruments registered

METRIC_REGISTRY=PASS
  6/6 metrics registered
  raw: open(CNY), high(CNY), low(CNY), close(CNY), volume(share)
  derived: change_pct(%)
  All metrics support line + bar marks
  Single source of truth: no other module hardcodes units

SCHEMA_STRUCTURAL_VALIDATION=PASS
  Zod strict mode: rejects unknown properties
  Rejects: null, empty object, invalid enum, missing fields, type errors
  Zod v4 compatibility: invalid_value mapped to INVALID_ENUM
  5/5 Golden Cases pass structural validation

SCHEMA_SEMANTIC_VALIDATION=PASS
  instrument: registry membership checked
  metrics: registry membership + unit consistency + id uniqueness
  series.field: existence in available fields
  series.mark: metric compatibility
  transform.field: existence
  annotation.transformRef: closure
  timeRange: data capability check
  dataSource.resolved: provider registration
  5/5 Golden Cases pass semantic validation

DASHBOARD_PATCH_VALIDATION=PASS
  4 patch types: replace_metric, add_metric, set_time_range, set_mark
  All patches validated against current spec before application
  Zod structural validation on patch input

PATCH_REVALIDATION=PASS
  Every patch application triggers full structural + semantic re-validation
  replace_metric handles dedup (target already in metrics)
  5/5 Follow-up Cases pass re-validation

GOLDEN_CASES=5/5 PASS
  G1: 收盘价+成交量+跌幅排名+replace_metric
  G2: 开盘价vs收盘价多序列+set_time_range
  G3: 涨跌幅柱状图+set_mark(line)
  G4: 成交量+top排名+set_time_range
  G5: 最高价+最低价+add_metric(close)

FOLLOWUP_CASES=5/5 PASS
  G1-F: replace volume→change_pct (dedup handled)
  G2-F: set time range to 10
  G3-F: set mark to line
  G4-F: set time range to 20
  G5-F: add close series to existing view

NEGATIVE_CASES=9/9 PASS
  N1: UNKNOWN_INSTRUMENT (未知股票)
  N2: UNSUPPORTED_METRIC (不支持的指标)
  N3: INVALID_TIME_RANGE (零天范围, structural)
  N4: INVALID_ENUM (不支持的图表类型, structural)
  N5: MISSING_SERIES_FIELD (series引用不存在metric)
  N6: MISSING_TRANSFORM_REF (annotation引用不存在transform)
  N7: TIME_RANGE_EXCEEDS_DATA (超出数据能力)
  N8: PATCH_TARGET_NOT_FOUND (替换不存在的metric)
  N9: PATCH_TARGET_NOT_FOUND (add到不存在的view)

RENDERER_CONTRACT_PROBE=PASS
  Verified: single-series line, multi-series line, bar, multi-axis (different units)
  Verified: annotation/markPoint mapping via transforms
  Verified: empty data returns failure
  Verified: validateEChartsOption rejects malformed options
  All 5 Golden Cases compile to valid ECharts options

METAMORPHIC_FIXTURES=READY
  3 pairs with 2-5 variants each
  Covers: price+volume, open vs close, bar chart
  Actual metamorphic tests deferred to Interpreter phase

REQUIREMENT_MAPPING=COMPLETE
  All 20+ requirement items mapped to design, module, and test evidence
  See docs/requirements-matrix.md

UNMAPPED_REQUIREMENTS=NONE

TYPECHECK=PASS (tsc -b, 0 errors)
TESTS=PASS (99/99)
LINT=PASS (oxlint, 0 errors, 0 warnings)
BUILD=PASS (vite build, 446ms)

SCHEMA_VERSION=1.0.0
SCHEMA_FREEZE_CANDIDATE=YES
```

## 自审发现的问题

| # | 问题 | 状态 | 详情 |
|---|------|------|------|
| 1 | replace_metric 产生重复 metric id | ✅ 已修复 | applyPatch 检查 to 是否已存在 |
| 2 | Zod v4 用 `invalid_value` 代替 `invalid_enum_value` | ✅ 已修复 | structural.ts 兼容两者 |
| 3 | Zod v4 invalid_type 无 received 属性 | ✅ 已修复 | 简化错误映射逻辑 |

## 自审检查清单

| 检查项 | 结果 |
|--------|------|
| 交易日和自然日是否混淆 | ✅ 无混淆，basis=trading_day |
| change_pct 是否在错误阶段计算 | ✅ 先算后截（回归测试验证） |
| raw/adjusted price 语义 | ✅ priceAdjustment=raw，明确 scope |
| 单位是否可能产生错误 | ✅ Metric Registry 唯一定义，语义校验比对 |
| preference 和 resolved 是否可能不一致 | ✅ Schema 分离，语义校验检查 resolved |
| metrics 与 series 职责是否混乱 | ✅ metrics=分析依赖，series=展示 |
| 多序列是否自然表达 | ✅ G2 (open+close) 和 G5 (high+low+close) 验证 |
| Follow-up 是否真正修改已有状态 | ✅ 不重新生成，applyPatch 增量修改 |
| Patch 后是否重新校验 | ✅ applyPatch 末尾调用 validateStructure + validateSemantics |
| Renderer 是否能处理所有合法 Schema | ✅ 所有 Golden Cases 编译为有效 ECharts option |
| 是否存在多模块重复定义业务规则 | ✅ Metric Registry 唯一定义 unit/supportedMarks |

## Schema 版本

- **schemaVersion**: 1.0.0
- **Zod version**: 4.6.5
- **TypeScript version**: 6.0.2
- **Vite version**: 8.3.0

## 冻结范围

以下模块在 Schema Freeze 后不可随意变更：

- `DashboardSpecSchema` (所有字段和类型)
- `DashboardPatchSchema` (所有操作类型)
- `MetricEntry` 结构
- `InstrumentEntry` 结构
- 错误码枚举

可扩展（向后兼容）：

- 新增 metric（不改变现有 metric 的 id/unit）
- 新增 mark type（不改变现有 mark）
- 新增 transform type
- 新增 patch op
- 新增 error code
