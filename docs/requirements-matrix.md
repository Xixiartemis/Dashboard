# Requirements Matrix — 题目要求到设计/模块/测试的映射

> 区分：REQUIREMENT_MAPPING = 设计落点已确定；FINAL_PRODUCT_IMPLEMENTATION = NOT_YET_EVALUATED

## 股票标识

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 支持股票标识 | `InstrumentEntry.symbol` | `registries/instruments.ts` | `foundation.test.ts > Instrument Registry` |
| 自然语言名称解析 | `InstrumentEntry.aliases` + `resolveInstrument()` | `registries/instruments.ts` | `foundation.test.ts > resolveInstrument works with aliases` |

## 指标

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 支持 open/high/low/close/volume/change_pct | `MetricRegistry` 6 entries | `registries/metrics.ts` | `foundation.test.ts > Metric Registry > all 6 metrics` |
| 指标唯一事实来源 | `MetricEntry` 定义 kind/unit/supportedMarks | `registries/metrics.ts` | 语义校验引用 registry |
| 涨跌幅由程序计算 | `computeChangePct()` 基于相邻日 close | `analytics/engine.ts` | `analytics.test.ts > computeChangePct` |

## 时间范围

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 最近 N 个交易日 | `TimeRangeSchema { mode: relative, basis: trading_day, count }` | `schema/dashboard-spec.ts` | `validation.test.ts > Structural Validation` |
| 范围限制 1-60 | Zod `.min(1).max(60)` | `schema/dashboard-spec.ts` | `negative-cases N3 (count=0)` |

## 图表类型

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 至少两种图表 | `MarkSchema = 'line' \| 'bar'` | `schema/dashboard-spec.ts` | G1 (bar), G2 (line), G3 (bar→line) |
| 不支持的图表类型被拒绝 | Zod enum 校验 | `validation/structural.ts` | `negative-cases N4` |

## 标题

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 每个 view 有标题 | `ViewSchema.title: string` | `schema/dashboard-spec.ts` | 所有 Golden Case 的 views 有 title |

## 数据来源

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 区分 preference 和 resolved | `DataSourceSchema { preference, resolved }` | `schema/dashboard-spec.ts` | 所有 Golden Case 的 dataSource 区分两者 |
| 默认 resolved = embedded_mock | Golden Cases fixture 中设置 | `fixtures/golden-cases.ts` | 全部 G1-G5 使用 embedded_mock |

## 数据截止时间

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| asOf 固定 | `MANIFEST.asOf = '2025-12-31'` | `data/manifest.ts` | `foundation.test.ts > manifest.asOf matches` |
| asOf 与最后交易日一致 | `invariants.ts > ASOF_CONSISTENCY` | `data/invariants.ts` | `foundation.test.ts > manifest.asOf matches last record date` |

## 单位

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 价格: CNY | `MetricEntry.unit = 'CNY'` | `registries/metrics.ts` | `foundation.test.ts > units are correct` |
| 成交量: share | `MetricEntry.unit = 'share'` | `registries/metrics.ts` | 同上 |
| 涨跌幅: % | `MetricEntry.unit = '%'` (5.2 = 5.2%) | `registries/metrics.ts` | 同上 |
| 语义校验检查 unit 一致性 | `validateSemantics` 比对 registry | `validation/semantic.ts` | N2 不支持指标测试 |

## 至少两种图表

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| line | G1/G2 使用 line | `fixtures/golden-cases.ts` | Golden Case tests |
| bar | G1 (volume) / G3 (change_pct) / G4 使用 bar | `fixtures/golden-cases.ts` | Golden Case tests |

## 图表数据和文字结论一致

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| insight 不允许自由产生数字 | `InsightFactSchema { kind, metric, label }` | `schema/dashboard-spec.ts` | Schema 只描述事实类型 |
| 真正数字由 Analytics 计算 | `computeInsight()` 使用同一份 analytics 结果 | `analytics/engine.ts` | 同一份 runAnalytics 结果 |

## 一次简单追问修改

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| replace_metric | `ReplaceMetricPatchSchema` | `schema/dashboard-patch.ts` | G1 follow-up |
| set_time_range | `SetTimeRangePatchSchema` | `schema/dashboard-patch.ts` | G2/G4 follow-up |
| set_mark | `SetMarkPatchSchema` | `schema/dashboard-patch.ts` | G3 follow-up |
| add_metric | `AddMetricPatchSchema` | `schema/dashboard-patch.ts` | G5 follow-up |
| Patch 后重新校验 | `applyPatch()` 末尾调用 validateStructure + validateSemantics | `patch/apply-patch.ts` | Golden Case follow-up tests |

## 过程状态

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 理解需求 | `METAMORPHIC_FIXTURES=READY` | `fixtures/metamorphic.ts` | Metamorphic fixtures test |
| 生成 Schema | `parseDashboardSpec()` | `schema/dashboard-spec.ts` | Structural validation tests |
| 渲染图表 | `compileViewToEChartsOption()` | `renderer/echarts-probe.ts` | Renderer probe tests |

## Schema 非法

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 必填字段缺失 | Zod `invalid_type` | `validation/structural.ts` | `validation.test.ts > rejects null/empty` |
| 字段类型错误 | Zod `invalid_type` | `validation/structural.ts` | 同上 |
| 非法 enum | Zod `invalid_value` | `validation/structural.ts` | N4 测试 |
| unknown property | Zod `.strict()` + `unrecognized_keys` | `validation/structural.ts` | `validation.test.ts > rejects unknown properties` |

## 指标不存在

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 不支持的指标 | `UNSUPPORTED_METRIC` 错误码 | `validation/semantic.ts` | N2 测试 |

## 数据为空

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 查询结果为空 | `AnalyticsResult.isEmpty` | `analytics/engine.ts` | Renderer probe > empty data test |

## 5 条自然语言生成样例

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| G1: 收盘价+成交量+跌幅 | `G1_SPEC` fixture | `fixtures/golden-cases.ts` | `golden-and-negative.test.ts` |
| G2: 开盘价vs收盘价 | `G2_SPEC` fixture | `fixtures/golden-cases.ts` | 同上 |
| G3: 涨跌幅柱状图 | `G3_SPEC` fixture | `fixtures/golden-cases.ts` | 同上 |
| G4: 成交量+最高排名 | `G4_SPEC` fixture | `fixtures/golden-cases.ts` | 同上 |
| G5: 最高价+最低价 | `G5_SPEC` fixture | `fixtures/golden-cases.ts` | 同上 |

## 正常生成测试

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 5/5 Golden Case 通过 | 结构+语义+分析+渲染全链路 | 全模块 | `golden-and-negative.test.ts > Golden Cases` |

## Schema 校验失败测试

| 要求 | 设计落点 | 模块 | 测试证据 |
|------|----------|------|----------|
| 9/9 Negative Case 通过 | N1-N9 覆盖全部错误码 | `fixtures/negative-cases.ts` | `golden-and-negative.test.ts > Negative Cases` |

---

## 未映射需求

无。所有题目要求均有明确的设计落点和实现路径。

## 状态声明

```
REQUIREMENT_MAPPING=COMPLETE
FINAL_PRODUCT_IMPLEMENTATION=NOT_YET_EVALUATED
```
