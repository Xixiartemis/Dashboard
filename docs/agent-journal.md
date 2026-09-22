# Agent Journal — DashboardSpec v1.0 Phase 0

## 1. 用户目标和约束

- 目标: 建立"自然语言生成股票分析看板"的核心数据契约（DashboardSpec v1.0）
- 约束: 确定性、可复现、不依赖真实行情接口、不依赖运行时 LLM、不依赖当天日期
- 范围: Mock Dataset + Registries + Schema + Validators + Analytics + Renderer Probe + Tests + Docs
- 不做: 完整 Interpreter、React 页面、ECharts 图表页面

## 2. 参考过的资料

| 来源 | 用途 |
|------|------|
| Vite React+TS 模板 | 工程骨架 |
| Vega-Lite data/transform/mark/encoding | 声明式分层设计 |
| ECharts dataset/encode | 数据与渲染配置解耦 |
| MS Data Formulator | 自然语言→数据→可视化的边界划分 |
| Zod v4 文档 | strict schema、safeParse、类型推导 |

详见 `docs/design-references.md`。

## 3. 重要设计选择

### 3.1 metrics vs views[].series[] 职责分离

**选择**: `metrics` = 分析依赖集合，`views[].series[]` = 实际展示。

**为什么**: 用户说"标出跌幅最大的3天"时，change_pct 必须在 metrics 中（供 transform 引用），但不一定直接画到图上。如果 metrics = 展示，就无法表达这种"隐式依赖"。

**拒绝的方案**: metrics = 页面展示指标。会导致 transform 无法引用未展示的指标。

### 3.2 change_pct 计算顺序

**选择**: 完整80日 raw series → 计算 change_pct → 截取最近N天。

**为什么**: 如果先截取30天再计算 change_pct，第1天的前一交易日 close 会丢失，导致该天 change_pct = 0 或计算错误。真正跌幅最大的交易日可能被漏掉。

**拒绝的方案**: 先截取再计算。这是最常见的实现错误。

**回归测试**: `analytics.test.ts > Time range and change_pct interaction > change_pct on first day of 30-day window uses previous day close`

### 3.3 Zod strict mode

**选择**: 所有 schema 使用 `.strict()`，拒绝未知字段。

**为什么**: 防止 schema 漂移。如果允许未知字段通过，Renderer 可能依赖未定义的行为。

### 3.4 DashboardPatch 领域语义

**选择**: 四种领域 Patch 操作（replace_metric, add_metric, set_time_range, set_mark），不用 RFC 6902。

**为什么**: RFC 6902 是通用 JSON Patch，无法保证 Patch 后的 Schema 仍然满足业务不变量。领域 Patch 可以在应用前做语义检查。

### 3.5 单位语义

**选择**: `5.2` 代表 `5.2%`，不是 `0.052`。

**为什么**: 金融领域约定俗成，避免 UI 层再做 ×100 转换。

### 3.6 Renderer Contract Probe

**选择**: 实现最小 ECharts option 编译器，验证 Schema 可被消费。

**为什么**: 防止"Schema Test 全 PASS → 开始写 ECharts → 才发现 Schema 不好映射"的问题。

### 3.7 Metamorphic Fixtures

**选择**: Phase 0 只建立 fixture，不执行 metamorphic test。

**为什么**: 没有 Interpreter 时无法真正测试自然语言变体的等价性。提前建立 fixture 为下一阶段做准备。

## 4. 实际发现的设计缺陷

### 4.1 replace_metric 重复指标

**原设计**: replace_metric 总是将 `from` 替换为 `to`。

**反例**: G1 的 metrics 已包含 `change_pct`（供 transform 使用）。当 Patch 把 `volume` 替换为 `change_pct` 时，会产生重复的 `change_pct` 条目。

**破坏的不变量**: metrics 中 id 必须唯一（semantic validation 中的 DUPLICATE_ID 检查）。

**修复**: 在 applyPatch 中检查 `to` 是否已存在，如果存在则只移除 `from`。

**测试**: `golden-and-negative.test.ts > G1 follow-up > metrics should have no duplicates`

### 4.2 Zod v4 错误码变更

**原设计**: 结构校验映射 `invalid_enum_value` → INVALID_ENUM。

**反例**: Zod v4 使用 `invalid_value` 代替 `invalid_enum_value`。

**破坏的不变量**: N4 测试（不支持的图表类型）无法正确映射错误码。

**修复**: 更新 structural.ts 中的错误码映射，同时兼容 `invalid_enum_value` 和 `invalid_value`。

**测试**: `validation.test.ts > N4: unsupported mark rejected by Zod`

### 4.3 Zod v4 invalid_type 缺少 received 属性

**原设计**: 结构校验通过 `issue.received` 判断是缺失字段还是类型错误。

**反例**: Zod v4 的 `$ZodIssueInvalidType` 没有 `received` 属性。

**修复**: 简化 structural.ts，直接使用 `issue.message` 传递类型错误详情，不再尝试区分缺失 vs 类型错误。

## 5. 实际运行的验证命令

```bash
# Typecheck
npx tsc -b
# 结果: 0 errors

# Tests
npx vitest run
# 结果: 5 files, 99 tests, all passed

# Lint
npx oxlint src/ tests/
# 结果: 0 errors, 0 warnings

# Build
npm run build
# 结果: success (446ms)
```

## 6. 主要修改文件

| 文件 | 用途 |
|------|------|
| `src/registries/instruments.ts` | Instrument Registry |
| `src/registries/metrics.ts` | Metric Registry |
| `src/data/manifest.ts` | Dataset Manifest |
| `src/data/mock-dataset.ts` | Mock OHLCV 数据 (80 天 × 2 股票) |
| `src/data/invariants.ts` | 数据不变量校验 |
| `src/schema/dashboard-spec.ts` | DashboardSpec Zod Schema + JSON Schema |
| `src/schema/dashboard-patch.ts` | DashboardPatch Zod Schema |
| `src/validation/errors.ts` | 错误码和中文消息 |
| `src/validation/structural.ts` | 结构校验 |
| `src/validation/semantic.ts` | 语义校验 |
| `src/analytics/engine.ts` | 分析引擎 (change_pct, rank, insight) |
| `src/patch/apply-patch.ts` | Patch 应用 + 重新校验 |
| `src/renderer/echarts-probe.ts` | Renderer Contract Probe |
| `src/fixtures/golden-cases.ts` | 5 Golden + 5 Follow-up Cases |
| `src/fixtures/negative-cases.ts` | 9 Negative Cases |
| `src/fixtures/metamorphic.ts` | Metamorphic Fixtures |
| `tests/foundation.test.ts` | Dataset + Registry 测试 |
| `tests/validation.test.ts` | Schema + Validation 测试 |
| `tests/analytics.test.ts` | Analytics 引擎测试 |
| `tests/golden-and-negative.test.ts` | Golden/Negative/Patch 测试 |
| `tests/renderer-probe.test.ts` | Renderer Contract Probe 测试 |
| `docs/design-references.md` | 设计参考调研 |
| `docs/requirements-matrix.md` | 需求映射矩阵 |
| `docs/agent-journal.md` | 本文档 |
| `docs/schema-freeze-report.md` | Schema Freeze 报告 |
