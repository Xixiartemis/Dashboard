# Design References — 设计参考调研

## 1. Vite 官方 React + TypeScript 模板

**参考了什么**: `npm create vite@latest -- --template react-ts` 生成的工程骨架。

**解决什么问题**: 提供最小、可靠的 React + TypeScript + Vite 开发环境。

**本项目采用了什么**:
- 标准 tsconfig.json 双配置结构 (app + node)
- ESM 模式 (`"type": "module"`)
- vitest 作为测试框架（与 Vite 深度集成）

**明确不采用**:
- 模板中的默认 App.tsx 样式代码（本项目 Phase 0 不做 UI 页面）
- CSS Module 模式（当前阶段无样式需求）

---

## 2. Vega-Lite 声明式可视化

**参考了什么**: Vega-Lite 的 `data → transform → mark → encoding` 职责划分。

**解决什么问题**: 理解声明式可视化规范中数据、转换、标记、编码如何分层。

**本项目采用了什么**:
- **data/transform 分离**: `metrics` 描述分析依赖，`transforms` 描述确定性分析操作（rank），`views[].series[]` 描述实际渲染。这与 Vega-Lite 的 data → transform → mark 分层一致。
- **声明式 mark**: `series.mark: 'line' | 'bar'`，Renderer 负责解释，Spec 只描述意图。
- **encoding 不在 Spec 中**: 类似 Vega-Lite 的 encoding 层由 Renderer 处理（颜色、样式等），Spec 只描述业务可视化意图。

**明确不采用**:
- Vega-Lite 的完整 JSON Schema（太重，本项目用 Zod 作为运行时 Schema）
- Vega-Lite 的 expression language（本项目用确定性代码计算，不允许 schema 中嵌入表达式）
- Vega-Lite 的交互语法（Phase 0 无交互需求）

---

## 3. Apache ECharts dataset / encode

**参考了什么**: ECharts 的 `dataset` + `encode` 设计，数据与图表配置解耦。

**解决什么问题**: 理解 ECharts 如何将数据字段映射到图表轴。

**本项目采用了什么**:
- **数据与渲染配置分离**: DashboardSpec 不包含 ECharts 专用配置（颜色、像素、grid、tooltip），由 Renderer Contract Probe 负责转换。
- **多系列支持**: `series[]` 数组设计借鉴了 ECharts 的多系列模式。
- **多 Y 轴**: 当 series 有不同 unit 时（CNY vs share），自动创建多 Y 轴，类似 ECharts 的 yAxis 数组模式。

**明确不采用**:
- ECharts 的 `encode` 语法（本项目用 `field` 简化映射）
- ECharts 的 `visualMap` / `dataZoom` 等高级功能（Phase 0 不需要）
- 直接暴露 ECharts Option 结构作为 DashboardSpec（职责混淆）

---

## 4. Microsoft Research Data Formulator

**参考了什么**: Data Formulator 的 `自然语言分析 → 数据转换 → 可视化 → 追问修改` 流程。

**解决什么问题**: 理解自然语言到可视化之间的边界划分。

**本项目采用了什么**:
- **追问修改是增量 Patch 而非全量重新生成**: Data Formulator 的后续交互模式启发了 DashboardPatch 设计。
- **数据转换是确定性的**: transform (rank) 由代码执行，不由 LLM 猜测结果。

**明确不采用**:
- Data Formulator 的 LLM 驱动数据变换（本项目要求确定性、可复现）
- 自动推荐可视化类型（本项目由用户指定或 Interpreter 规则映射）

---

## 5. JSON Schema / Zod

**参考了什么**: Zod 官方文档（strict mode、safeParse、类型推导）和 JSON Schema 规范。

**解决什么问题**: 运行时类型校验、未知字段拒绝、类型安全的 Schema 定义。

**本项目采用了什么**:
- **Zod strict schema**: `.strict()` 拒绝未知字段，作为 DashboardSpec 的唯一事实来源。
- **TypeScript 类型从 Zod 推导**: `z.infer<typeof DashboardSpecSchema>` 避免类型和 Schema 漂移。
- **safeParse**: 不抛异常，返回结构化错误，便于映射到用户可读错误码。
- **Zod v4**: 使用最新版本，注意 `invalid_value` 代替 v3 的 `invalid_enum_value`。

**明确不采用**:
- 手动维护 JSON Schema（从 Zod 手动导出一份简化的 JSON Schema 用于文档，但运行时以 Zod 为准）
- Zod 的 `.passthrough()` 模式（本项目严格拒绝未知字段）
