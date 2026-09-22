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
