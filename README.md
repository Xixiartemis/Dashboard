# 一句话生成股票分析看板

用户输入一句自然语言股票分析请求，系统将其转换为可验证的 DashboardSpec，使用确定性数据分析引擎生成 ECharts 图表和数据结论，并支持通过同一个自然语言输入框继续修改当前看板。

```
Natural Language → Intent IR → DashboardSpec → Validation → Data → Analytics → ECharts → Dashboard
```

**默认模式：** Deterministic Interpreter + 嵌入式可复现模拟数据

## 快速启动

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run test         # 428 unit/integration tests
npm run benchmark    # 33 core + 15 browser acceptance tests
npm run build        # production build
```

## Demo 能力

### 5 个 Golden Examples

| ID | 自然语言 | 演示能力 |
|----|---------|---------|
| G1 | 分析A公司最近30个交易日的收盘价和成交量，并标出跌幅最大的3个交易日 | 多指标 + 跌幅排名 |
| G2 | 比较B公司最近20个交易日的开盘价和收盘价走势 | 多序列比较 + 区间变化 |
| G3 | 用柱状图展示A公司最近15个交易日的涨跌幅，并标出涨幅最大的3天 | 柱状图 + 涨幅排名 |
| G4 | 查看B公司最近30个交易日的成交量，并标出成交量最高的5天 | 成交量分布 + Top5 |
| G5 | 分析A公司最近20个交易日的最高价和最低价走势 | 高低价比较 + 区间变化 |

### 追问修改（Follow-up）

同一个输入框，系统自动识别是新建分析还是追问修改：

| 追问 | 操作类型 |
|------|---------|
| 把成交量改成涨跌幅 | 替换指标 |
| 改为最近10个交易日 | 修改时间范围 |
| 改成折线图 | 修改图表类型 |
| 再加上收盘价 | 新增指标 |

## Architecture

```
src/
  interpreter/          # NL → Intent IR → DashboardSpec
    normalize/          # 表面文本规范化
    extract/            # 中文槽位提取
    resolver/           # 概念 → Canonical ID
    compiler/           # Intent → Frozen DashboardSpec
    intent.ts           # Canonical Intent IR
    policies.ts         # 确定性策略
    errors.ts           # 错误模型
    comparison.ts       # 语义比较
  application/          # 异步 API + Pipeline
    contracts.ts        # UI ↔ Domain 契约
    dashboard-service.ts
    materializer.ts
  runtime/              # Controller + Composition Root
    dashboard-controller.ts   # 状态管理 + subscribe
    dashboard-runtime.ts      # 组装根
    reduce-pipeline-event.ts  # 事件归约
  schema/               # DashboardSpec Zod Schema (frozen)
  analytics/            # 时序计算引擎
  data/                 # 嵌入式模拟数据集
  registries/           # 指标/标的信息注册表
  validation/           # 结构 + 语义校验
  patch/                # DashboardPatch 应用
  renderer/             # ECharts 探测
  components/           # React UI
  ui-runtime/           # React ↔ Runtime 适配
```

## DashboardSpec

核心 Schema 由 Zod 定义，包含：

```typescript
{
  schemaVersion: '1.0.0',
  instrument: { symbol, displayName, assetType },
  timeRange: { mode: 'relative', basis: 'trading_day', count, end: 'data_as_of' },
  metrics: [{ id, label, kind, unit }],
  dataSource: { preference, resolved, datasetId, asOf, timezone },
  transforms: [{ id, type: 'rank', field, order, limit }],
  views: [{ id, title, series: [{ id, field, mark, unit }], annotations }],
  insight: { intentSummary, facts: [period_change | rank_summary] }
}
```

完整定义：[src/schema/dashboard-spec.ts](src/schema/dashboard-spec.ts)

## 数据口径

- **数据源：** 嵌入式固定模拟数据集
- **标的：** MOCK.A（A公司）、MOCK.B（B公司）
- **时间跨度：** 80 个交易日
- **截止日期：** 2025-12-31
- **时区：** Asia/Shanghai
- **日历：** MOCK_WEEKDAY（排除周末，非真实交易所日历）
- **价格类型：** 原始价格（raw）
- **成交量单位：** 股（share）
- **数据用途：** 仅用于演示验证，不构成投资建议

## Deterministic Interpreter

系统使用确定性规则解释器，不依赖 LLM：

- **Normalizer：** 全角/半角、空格、标点、同义词统一
- **Extractor：** 中文槽位提取（股票、指标、时间、图表、排名）
- **Resolver：** 自然语言概念 → Canonical ID（通过 Registry）
- **Compiler：** Intent IR → DashboardSpec（唯一知道 Spec 结构的模块）

设计原则：如果语义理解正确，Compiler 保证生成合法 Spec。

## Validation & Error Handling

- 结构校验（Structural Validator）
- 语义校验（Semantic Validator）
- 7 种 Interpreter 错误类型映射到用户可读中文消息
- Follow-up 失败保留当前 Dashboard（不全屏报错）

## Benchmark & Tests

| 套件 | 测试数 | 结果 |
|------|--------|------|
| Unit/Integration (vitest) | 428 | PASS |
| Browser Acceptance (Playwright) | 15 | PASS |
| **总计** | **443** | **PASS** |

- 5 个 Initial 全链路 ✓
- 5 个 Follow-up 全链路 ✓
- 数据结论 5/5 ✓
- 确定性验证 ✓
- 错误处理 ✓
- 浏览器 Console 错误 = 0
- 响应式 1440/1280/768 ✓

## Agent 开发过程

项目使用 Agent 辅助完成：

- Schema 设计与 Contract 冻结
- Application Boundary 建立
- Interpreter 分层架构（Block 1-4）
- 评测语料与系统性加固
- Runtime 集成与 UI 接入
- 验收 Benchmark

详细工程决策记录：[docs/agent-journal.md](docs/agent-journal.md)

原始对话记录将随提交材料单独提供。

## WenCai 状态

为满足题目对自包含、可复现 Demo 的要求，当前提交默认使用内置固定模拟数据。

DashboardSpec 的 `dataSource.preference` 字段已预留 `wencai` 枚举值，但本版本**没有实现 WenCai Provider**。Runtime 当前固定使用 `embedded_mock`。不会将未实现的能力描述为已完成。

## Known Limitations

1. 仅支持文档化的有限中文语言模式（不支持自由形式自然语言）
2. 当前不接入真实证券行情数据
3. WenCai Provider 未实现
4. 仅支持 line / bar 两种图表类型
5. 单一 timeRange / 单一 preferredMark（不支持"最近10天和30天"）
6. 模拟日历仅排除周末，非真实交易所日历
7. 不提供投资建议或预测功能
8. G2/G5 的数据结论为区间变化（period_change），非复杂金融分析
