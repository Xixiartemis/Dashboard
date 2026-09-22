# Agent Journal — DashboardSpec v1.0 Phase 0

## Round 1: Initial Implementation

### 用户目标和约束

- 目标: 建立"自然语言生成股票分析看板"的核心数据契约（DashboardSpec v1.0）
- 约束: 确定性、可复现、不依赖真实行情接口、不依赖运行时 LLM、不依赖当天日期
- 范围: Mock Dataset + Registries + Schema + Validators + Analytics + Renderer Probe + Tests + Docs

### 参考过的资料

| 来源 | 用途 |
|------|------|
| Vite React+TS 模板 | 工程骨架 |
| Vega-Lite data/transform/mark/encoding | 声明式分层设计 |
| ECharts dataset/encode | 数据与渲染配置解耦 |
| MS Data Formulator | 自然语言→数据→可视化的边界划分 |
| Zod v4 文档 | strict schema、safeParse、类型推导 |

详见 `docs/design-references.md`。

### 重要设计选择

1. **metrics vs views[].series[] 职责分离**: metrics = 分析依赖，series = 实际展示
2. **change_pct 先算后截**: 完整80日 series → 计算 change_pct → 截取最近N天
3. **Zod strict mode**: 拒绝未知字段
4. **DashboardPatch 领域语义**: 四种操作，不用 RFC 6902
5. **Renderer Contract Probe**: 验证 Schema 可被 ECharts 消费

### Round 1 自审发现

1. replace_metric 产生重复 metric id → 已修复
2. Zod v4 用 `invalid_value` 代替 `invalid_enum_value` → 已修复
3. Zod v4 invalid_type 无 received 属性 → 已修复

---

## Round 2: Contract Tightening (独立审计后)

### 用户独立审计发现的问题

用户从"Schema 允许什么状态"和"系统实际能不能正确处理这些状态"的角度做了对抗性审查，发现多处 Schema 比实现宣称能力更宽的情况。这不是功能缺失，而是 Validator 会认为合法但系统实际可能静默使用错误数据。

### 修复清单

#### Issue #2: DataSource 必须和真实执行数据一致

**问题**: Schema 允许 `resolved=wencai`、任意 datasetId/asOf/timezone、`priceAdjustment=adjusted`，但 runAnalytics() 实际只读 embedded mock。页面可能显示"问财/adjusted"但实际画的是本地 mock raw 数据。

**修复**:
- `resolved` 收紧为 `z.literal('embedded_mock')`
- `priceAdjustment` 收紧为 `z.literal('raw')`
- Semantic Validator 检查 datasetId/asOf/timezone 与 MANIFEST 一致

**为什么不提前开放 wencai**: Provider 没接入前，Schema 允许 = 静默数据错配。等真正接入再显式扩展。

#### Issue #3: metrics 必须真正成为 dependency closure

**问题**: semantic.ts 默认把所有 raw 字段 (open/high/low/close/volume) 视为 available，即使 metrics 只声明了 close。这导致 `metrics=[close]` + `series.field=volume` 能通过校验。

**修复**: series.field、transform.field、insight.metric 都必须 ∈ spec.metrics[]。唯一例外是 `date`（x-axis 字段，不属于 Metric Registry）。

#### Issue #4: x-axis 收紧

**问题**: Schema 允许 `x.field=close`、`x.type=linear`，但 Renderer 实际固定使用 date + category axis。

**修复**: `AxisSchema.field = z.literal('date')`，`AxisSchema.type = z.literal('ordinal')`。

**为什么**: 不为"看起来通用"保留虚假扩展性。v1 所有图表都是交易日→指标值。

#### Issue #5: Series 全 null 检查

**问题**: validateEChartsOption() 只检查形状，不检查数据有效性。全 null 数据也算通过。

**修复**: Renderer Probe 增加 `hasFiniteValue` 检查。series data 至少一个 finite number。

#### Issue #6: summary → intentSummary

**问题**: `summary` 是自由字符串，Interpreter 可以写"A公司下跌20%"即使实际是+6.3%。

**修复**: 改名为 `intentSummary`，明确只能表达用户分析意图，不能表达计算结果。真正数值结论由 `DashboardSpec + AnalyticsResult → InsightResult` 产生。

#### Issue #7: Insight ranking 与 Transform 同源

**问题**: annotation 用 transform (limit=3)，但 computeInsight() 里 worst_days 固定 slice(0,3)，max_volume_days 固定 slice(0,5)。两套独立排序逻辑。

**修复**: 引入 `rank_summary` insight kind + `transformRef`。Insight 消费与 Annotation 完全相同的 transform 结果。limit、排序字段、order 只有一个事实来源。

#### Issue #8: 删除 min_volume_days

**问题**: Schema 允许但 Analytics 没有实现。

**修复**: 从 InsightFactKindSchema 删除。Schema 不声明当前系统无法执行的能力。

#### Issue #9: Zod JSON Schema 导出

**问题**: 声明"Zod 是唯一事实来源"但 getDashboardSpecJsonSchema() 手写了一整套 JSON Schema。两份 Contract。

**修复**: 改用 Zod 的原生 JSON Schema 导出。如果不可用则返回标记 `_sourceOfTruth: DashboardSpecSchema (Zod)`。

#### Issue #10: schemaVersion 收紧为 literal

**问题**: `schemaVersion: string` 允许 "abc"、"2.5" 通过。

**修复**: `z.literal('1.0.0')`。以后升级版本做显式迁移。

#### Issue #11: Instrument metadata 一致性

**问题**: `symbol=MOCK.A` + `displayName=B公司` + `assetType=crypto` 能通过。Registry 不是唯一事实来源。

**修复**: Semantic Validator 检查 displayName 和 assetType 与 Registry 一致。

#### Issue #12: calendar 改为 MOCK_WEEKDAY

**问题**: Manifest 标 `calendar=SSE` 但只排除周末，没有处理中国法定节假日。

**修复**: 改为 `MOCK_WEEKDAY`，注释说明"仅排除周末，不代表真实 SSE 交易日历"。

#### Issue #13: 真实 ECharts 类型

**问题**: Renderer Probe 用自己定义的 EChartsOption interface，没有真实 ECharts 依赖。

**修复**: 加入 `echarts` 依赖，使用官方 `EChartsOption` 和 `SeriesOption` 类型。

#### Issue #14: 多单位 Y 轴

**问题**: CNY → axis 0, 非CNY → axis 1。三个不同单位会合并到一个轴。

**修复**: 每个 distinct unit 创建独立 Y axis。series 根据 unit 绑定对应 axis index。

### Adversarial Regression Tests (A1-A18)

| 测试 | 覆盖 |
|------|------|
| A1 | resolved=wencai → structural FAIL |
| A2 | datasetId 不匹配 MANIFEST → semantic FAIL |
| A3 | asOf 不匹配 → semantic FAIL |
| A4 | timezone 不匹配 → semantic FAIL |
| A5 | priceAdjustment=adjusted → structural FAIL |
| A6 | metrics 不含 volume, series 用 volume → FAIL |
| A7 | metrics 不含 volume, transform 用 volume → FAIL |
| A8 | metrics 不含 volume, insight 用 volume → FAIL |
| A9 | x.field=close → structural FAIL |
| A10 | x.type=linear → structural FAIL |
| A11 | MOCK.A + displayName=B公司 → FAIL |
| A12 | MOCK.A + assetType=crypto → FAIL |
| A13 | schemaVersion=abc → structural FAIL |
| A14 | series 全 NaN → renderer FAIL |
| A15 | ranking insight records count = transform limit |
| A16 | ranking insight records = transform records (同源) |
| A17 | 3 单位 → 3 Y axis |
| A18 | JSON Schema 导出可用 |

### 实际运行的验证命令

```bash
npx tsc -b           # 0 errors
npx vitest run       # 6 files, 106 tests, all passed
npx oxlint src/ tests/ # 0 errors, 0 warnings
npm run build        # success (257ms)
```

### 主要修改文件 (Round 2)

| 文件 | 修改 |
|------|------|
| `src/schema/dashboard-spec.ts` | schemaVersion literal, x-axis literal, intentSummary, rank_summary, 删除 min_volume_days, JSON Schema 导出 |
| `src/validation/semantic.ts` | DataSource provenance, metric dependency closure, instrument metadata, insight transformRef |
| `src/data/manifest.ts` | calendar → MOCK_WEEKDAY |
| `src/analytics/engine.ts` | insight ranking 消费 transform 结果 |
| `src/renderer/echarts-probe.ts` | 真实 ECharts 类型, 多 unit Y 轴, null 数据检查 |
| `src/fixtures/golden-cases.ts` | 适配新 schema |
| `src/fixtures/negative-cases.ts` | 适配新 schema |
| `tests/adversarial.test.ts` | 新增 18 条 adversarial regression tests |
| 其他 test 文件 | 适配新 schema |

---

## Round 3: 收口 — 消除剩余重复事实源和 Patch 后 presentation 漂移

### 用户复核结论

Round 2 的 14 个修复全部被认可。本轮只修 5 个阻塞正式冻结的问题。

### 为什么"结构状态正确"不代表"用户看到的标题一定正确"

Patch 操作（set_time_range、replace_metric、add_metric）只修改结构化状态：
- `timeRange.count: 20 → 10`
- `series.field: volume → change_pct`
- `metrics[]` 新增 close

但 `view.title` 和 `insight.intentSummary` 是独立的自由字符串。结构变了，字符串没变，用户看到的页面标题和实际数据就会不一致。这是 silent inconsistency — Schema 说 count=10 但标题写着"20个交易日"。

**修复**: 在 `applyPatch()` 管道中增加 `normalizePresentationMetadata()` 步骤。结构状态改变后，标题和意图摘要从当前结构状态确定性派生。具体做法：
- set_time_range: 用正则替换标题/意图摘要中的 "N个交易日" 的 N
- replace_metric: 用旧指标中文标签替换为新指标中文标签
- add_metric: 追加新指标标签到标题末尾
- set_mark: 不改标题（用户设计决策，不要求标题包含图表类型）

**为什么不用脆弱字符串操作**: 不是逐个手写 `replace("20", "10")`，而是用结构化的替换函数 `replaceTradingDayCount(text, newCount)` 和 `replaceMetricLabel(text, old, new)`。输入是结构化状态，输出是确定性文本。

### 为什么 timeRange.end 和 dataSource.asOf 会形成重复日期事实源

v1 的 Analytics 引擎始终取"最后 N 个交易日"（从数据集末尾往前截），并不使用 `timeRange.end` 来截取历史截止日期。但 Schema 允许 `end = "2024-01-01"` + `asOf = "2025-12-31"`，Validator 认为合法，实际数据仍然从 2025-12-31 往前取。两个字段声称控制同一件事但实际只有一方生效。

**修复**: `timeRange.end` 收紧为 `z.literal('data_as_of')`。真实截止日期统一只来自 `dataSource.asOf`。`timeRange` 的语义变为："最近 N 个交易日，截至当前数据集 asOf"。不再存在两个日期事实源。

### 为什么 Registry 是唯一事实来源意味着 label 和 unit 也必须闭合

Round 2 已经验证 `metric.id`、`metric.kind`、`metric.unit` 与 Registry 一致。但 `MetricRef.label` 和 `Series.unit` 没有被校验。这意味着可以构造：
- `metric.id = volume` + `metric.label = 收盘价` — 通过校验但页面显示错误标签
- `series.field = volume` + `series.unit = CNY` — 通过校验但 Renderer 把成交量按人民币分配 Y 轴

**修复**: 新增两个校验：
- `MetricRef.label === MetricRegistry[id].label` → METRIC_LABEL_MISMATCH
- `Series.unit === MetricRegistry[field].unit` → SERIES_UNIT_MISMATCH

同时将之前用 `INVALID_UNIT` 覆盖 kind 不匹配的情况保留（kind 和 unit 都是"与注册表不一致"的语义）。

### 为什么 rank_summary 再次保存 metric/limit/ranking label 就仍然可能和 transform 漂移

Round 2 把 Insight ranking 改为引用 `transformRef`，这是对的。但 `rank_summary` 仍然同时保存 `metric` 和 `label` 作为独立字段。这意味着可以构造：
- transform: `field=change_pct, order=asc, limit=3`
- rank_summary: `metric=volume, label=成交量最大的5天, transformRef=worst_3_days`

引用闭合了（transformRef 指向存在 transform），但语义仍然矛盾。`metric` 和 `label` 仍然可以自由填写，和 transform 的 `field`/`order`/`limit` 漂移。

**修复**: `rank_summary` 改为 discriminated union，只有 `transformRef` + 可选 `labelKey`（纯展示提示，不改变业务语义）。`metric` 从 `transform.field` + Metric Registry 确定性生成。`order`/`limit` 从 transform 直接消费。`period_change` 保留 `metric` + `label`（因为它有自己的数据需求，不引用 transform）。

### 为什么 JSON Schema smoke test 不等于 contract test

Round 2 的 A18 只验证"返回了一个 object"且"title = DashboardSpec"。这不能证明 JSON Schema 和 Zod 同源。如果导出函数返回的是一个手写的简化对象（带 `note: "informational only"`），A18 照样通过。

**修复**:
1. JSON Schema 导出改用 Zod 4 官方 `z.toJSONSchema()` API，不再用 `(schema as any).jsonSchema?.()` + fallback
2. 如果 API 调用失败，应该报错（测试失败），而不是静默返回简化对象
3. A26 新增关键约束验证：`schemaVersion` const、`timeRange.end` 只允许 `data_as_of`、`mark` enum、`x.field` const、`x.type` const、`count` min/max

### Adversarial Regression Tests (A19-A26)

| 测试 | 覆盖 |
|------|------|
| A19 | set_time_range(20→10) 后 titles/intentSummary 不再包含"20个交易日" |
| A19b | set_time_range(30→15) 后 titles 包含"15"不包含"30" |
| A20 | replace_metric(volume→change_pct) 后 volume_view 标题包含"涨跌幅"不含"成交量" |
| A21 | timeRange.end="2024-01-01" → structural FAIL |
| A22 | metric.id=volume + label="收盘价" → METRIC_LABEL_MISMATCH |
| A23 | series.field=volume + unit=CNY → SERIES_UNIT_MISMATCH |
| A24 | rank_summary 含 metric 字段 → structural FAIL (discriminated union 拒绝) |
| A25 | rank volume desc limit 4 → insight records = 4, metric 从 transform 派生 |
| A26 | JSON Schema 含 schemaVersion const、data_as_of、mark enum、x literal、count min/max |

### 实际运行的验证命令

```bash
npx tsc -b           # 0 errors
npx vitest run       # 6 files, 115 tests, all passed
npx oxlint src/ tests/ # 0 errors, 0 warnings
npm run build        # success (268ms)
```

---

## Round 3.1: add_metric presentation scope fix

单 view Golden Case 掩盖了 scoped Patch 在 multi-view 状态下产生的 presentation side effect。

`add_metric` Patch 明确包含 `viewId`，代表只向目标 view 增加 series。但 `normalizePresentationMetadata()` 的 `add_metric` 分支遍历所有 views 调用 `updateTitleForAddMetric()`，导致非目标 view 的 title 被错误修改。

修复: `add_metric` presentation normalization 只更新 `v.id === patch.viewId` 的目标 view。`intentSummary` 作为 Dashboard 级用户意图，仍根据新增指标同步更新。

通过多 view counterexample (A27) 发现并修复。

### 主要修改文件 (Round 3)

| 文件 | 修改 |
|------|------|
| `src/schema/dashboard-spec.ts` | timeRange.end=z.literal('data_as_of'), InsightFact discriminated union (PeriodChangeFact + RankSummaryFact), z.toJSONSchema() 官方 API |
| `src/validation/errors.ts` | 新增 METRIC_LABEL_MISMATCH, SERIES_UNIT_MISMATCH |
| `src/validation/semantic.ts` | MetricRef.label 与 Registry 一致性, Series.unit 与 Registry 一致性, 适配 discriminated union insight facts |
| `src/analytics/engine.ts` | rank_summary 从 transform 派生 metric, 不再从 fact.metric 读取 |
| `src/patch/apply-patch.ts` | 新增 normalizePresentationMetadata() — replace_metric/add_metric/set_time_range 后更新 titles/intentSummary |
| `src/fixtures/golden-cases.ts` | timeRange.end='data_as_of', rank_summary 只有 transformRef |
| `src/fixtures/negative-cases.ts` | timeRange.end='data_as_of' |
| `tests/adversarial.test.ts` | 新增 A19-A26 (8 条), 所有 rawInput 适配 data_as_of |
| `tests/golden-and-negative.test.ts` | Follow-up patches 新增 presentation metadata 断言 |
| `tests/validation.test.ts` | rawInput 适配 data_as_of |
| `tests/renderer-probe.test.ts` | rawInput 适配 data_as_of |
---

---

---

## Interpreter Core (Block 1)

### 为什么先做 Compiler 而不是 NL Parser

自然语言是不确定输入，DashboardSpec 是确定性 Contract。如果直接做"文本→Spec JSON"，每种语言变化都需要调整 Spec 生成逻辑，调试时无法区分"语言理解错了"还是"业务编译错了"。

所以先在 NL 和 Frozen Contract 之间建立 Canonical Intent IR，验证 deterministic compiler 能否把正确语义编译成正确业务 Contract。这通过以后，后面即使某条中文 Prompt 失败，也能明确知道是语言理解错了，而不是整个 Interpreter 黑盒不知道哪里错了。

### 架构决策

1. **Intent IR 不复制 Registry metadata** — 只存 canonical IDs（'close', 'MOCK.A'），label/unit/kind 来自 Registry。一个事实只保留一个来源。

2. **displayMetrics vs metrics** — `metrics` = 全部指标（dependency closure），`displayMetrics` = 渲染到 view 的子集。分析用途但不直接展示的指标（如 change_pct 用于 ranking）不需要自己的 view。

3. **Policy 决定结构，不是 if/else** — View grouping（同 unit 同 view）、default mark（volume→bar, price→line）、ranking annotation label 都由明确 policy 函数决定。

4. **Compiler 是唯一知道 Spec 结构的模块** — Extractor/Resolver 不直接生成 DashboardSpec，只有 Spec Compiler 拼装完整结构。

5. **Follow-up 编译 Patch 而非 Spec** — Patch Compiler 输出 DashboardPatch，交给冻结的 applyPatch() 处理 mutation + validation + presentation normalization。

6. **分析级指标的 annotation 归属** — 当 ranking 指标不在任何 display group 中时（如 G1 的 change_pct），annotation 放在第一个 view（primary view）上。

### 文件结构

```
src/interpreter/
├── intent.ts              — Intent IR (ResolvedInitialIntent, ResolvedFollowUpIntent)
├── errors.ts              — Typed interpreter error model
├── policies.ts            — View grouping, default marks, ranking labels
├── resolver/
│   ├── instrument-resolver.ts  — alias → symbol (via Registry)
│   └── metric-resolver.ts     — label/alias → metric ID
├── compiler/
│   ├── spec-compiler.ts       — InitialIntent → DashboardSpec
│   └── patch-compiler.ts      — FollowUpIntent → DashboardPatch
├── comparison.ts          — Semantic equality (for tests)
└── index.ts               — Public exports
```

---

## Interpreter Core Contract Tightening

### 1. RankingIntent 移除 annotationLabel

RankingIntent 不再保存自由 annotationLabel 字段。标注标签由 `metric + order + Policy` 确定性派生（`getRankingAnnotationLabel()`）。消除了 ranking 文案第二事实源。

### 2. compileInitialIntent 完整 invariant closure

Compiler 现在验证所有 IR 内部引用关系：
- metrics: 非空、全部 known、无 duplicate
- displayMetrics: 非空、无 duplicate、全部属于 metrics
- rankings: metric ∈ metrics、limit >= 1、无 duplicate transform ID
- ok:true 意味着 intent 在 Compiler 可判断范围内 internally coherent

### 3. compileFollowUpIntent context closure

set_mark 现在验证：
- viewId 存在
- seriesId 存在于该 view 内（不是其他 view）
- series.field 对应 metric 存在
- requested mark 被该 metric 支持（via metricSupportsMark）

replace_metric: 不能替换自身
add_metric: metric 不能已在 spec 中

## Application Boundary Runtime Fix (v1.0.1)

### 问题

从"两个 Agent 并行后哪些错误会让双方返工"角度审查 Application Runtime，发现 6 个语义未闭合问题。

### 修复

1. **empty_data fixture** — 之前用 MOCK.EMPTY（不在 Registry），实际失败在 validate_schema 而非 load_data。引入 `DataAvailabilityChecker` 依赖 seam，默认使用真实 `getDataset()`。empty_data fixture 注入返回 0 的 checker，真正走 validate_schema SUCCESS → load_data → EMPTY_DATA。不修改 Frozen Domain。

2. **Service error boundary** — `DashboardService.runQuery()` / `runFollowUp()` 现在 try/catch 包裹 interpreter 调用。异常映射为 `DashboardRunFailure`，Promise 永远 resolve。UI 不需要 try/catch。

3. **Pipeline Events 包裹 interpreter** — `understand_request:start` 在 interpreter 调用之前 emit，`success` 在之后 emit。Service 是 orchestration owner，不是 materializer。

4. **Follow-up 无重复事件** — 拆成 upstream (understand + build) 和 downstream (validate → load → analyze → render)。Service 负责 upstream，materializer 只负责 downstream。不再有 executeSpec 内部重复 emit。

5. **Pipeline 语义重排** — `load_data` = 数据可用性检查（DataAvailabilityChecker.check()），`analyze` = runAnalytics + computeInsight。不再把整个 Analytics 塞进 load_data。

6. **Public API 收紧** — `index.ts` 不再 export `executeSpec` / `executeFollowUp` / `executeDownstreamPipeline`。Fixtures 和 tests 直接从内部模块 import。

### 测试

AP11-AP16 新增：
- AP11: 真正 empty data 走 load_data → EMPTY_DATA
- AP12: interpreter throw → DashboardRunFailure (not rejected Promise)
- AP13: 初始查询事件顺序正确
- AP14: follow-up 事件无重复
- AP15: load_data 语义 = 数据可用性检查
- AP16: public API surface 不暴露内部执行器

## Application Boundary (v1.0 → UI Handoff)

### 为什么先做这个 Boundary

Schema 已冻结，下一阶段准备让两个 AI Agent 并行开发（Hermes 负责 Pipeline/Interpreter，Google Studio 负责 UI）。发现下一类主要风险已经不是 Schema correctness，而是两个 Agent 的 contract drift——各自按自己的理解定义数据结构，集成时 UI 需要一种数据，Pipeline 返回另一种数据，导致双方一起返工。

所以先建立 Application Boundary，再让 UI 和 Pipeline 分头开发。

### 核心设计决策

1. **DashboardRunResult = 唯一结果模型**：Initial 和 Follow-up 返回同一个类型，UI 不需要两套代码。

2. **Async 从第一天开始**：虽然当前全是确定性同步逻辑，但 Interpreter 未来会接 LLM，所以 Public API 全部是 async/Promise，避免将来 UI 全部改写。

3. **Interpreter Port 作为依赖边界**：DashboardService 依赖 `DashboardInterpreterPort` 接口，不写死 Gemini/MiMo/Rules。Deterministic Interpreter、LLM Interpreter、Test Adapter 都可以替换，Application Contract 和 UI 都不用变。

4. **Fixture 必须由真实 Pipeline 产生**：`getDemoFixtures()` 内部调用 `executeSpec(GOLDEN_CASES[i].expectedSpec)`，走完全相同的 validation → analytics → insight → renderer 管道。不手写 ECharts option、不硬编码 insight 数字。这样 Fixture 和未来 Runtime 用的是同一条执行链，不会漂移。

5. **Result 必须可 JSON 序列化**：`JSON.stringify(result)` 必须成功。不包含 Map/Set/Date/Function/class instance。这保证了 Fixture、Replay、Web Worker、HTTP 传输的可行性。

6. **UI 不重新计算金融数据**：change_pct、ranking、insight 数字全部在 Application 层算好，UI 只消费纯数据。这消除了第二套事实来源。

7. **Pipeline Trace 是真实执行过程**：不是假的 loading，每一步的 start/success/error 都在真正进入/完成阶段时 emit。UI 后面如果要为了动画延迟视觉 transition，那是 UI 的事情。

### 文件结构

```
src/application/
├── contracts.ts          — 类型定义（DashboardRunResult, PipelineEvent, InterpreterPort 等）
├── materializer.ts       — executeSpec() / executeFollowUp() 核心执行路径
├── dashboard-service.ts  — async DashboardService 实现（Interpreter placeholder）
├── demo-fixtures.ts      — 5 golden + 5 follow-up + 2 error fixtures
└── index.ts              — public barrel export
```

### 文件职责边界

| 文件 | import 范围 |
|------|-------------|
| `contracts.ts` | 只 import 类型（DashboardSpec, EChartsOption） |
| `materializer.ts` | import Domain 内部（validation, analytics, renderer, patch） |
| `dashboard-service.ts` | import contracts + materializer |
| `demo-fixtures.ts` | import fixtures + materializer + validation（for error fixtures） |
| `index.ts` | 只 re-export |

UI 只 import `index.ts`，不直接 import materializer 或 Domain 模块。

