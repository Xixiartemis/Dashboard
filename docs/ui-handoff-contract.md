# UI Handoff Contract — Dashboard v1.0

> 此文档是 Google AI Studio 开发 Dashboard UI 的唯一权威上下文。
> UI 只消费 `src/application/` 暴露的类型和函数，不直接操作 Domain 内部。

---

## 1. 架构分层

```
┌─────────────────────────────────┐
│          UI (React)             │  ← Google Studio 负责
├─────────────────────────────────┤
│     Application Boundary        │  ← src/application/ (已冻结)
├─────────────────────────────────┤
│   Domain (Schema/Analytics/…)   │  ← Hermes 负责 (内部可变)
└─────────────────────────────────┘
```

## 2. UI 可以负责

- Layout / Typography / Responsive
- Prompt Input 组件
- Example Prompt Buttons
- Pipeline Visualization（步骤进度条/动画）
- Chart Rendering（ECharts 组件，消费 `charts[].option`）
- Insight Card 展示
- Schema Inspector（JSON 展示 `result.spec`）
- Follow-up Input
- Loading State
- Error / Empty State
- Animation / Visual Polish
- Theme / Color

## 3. UI 不负责（禁止实现）

- `change_pct` 计算
- ranking / sorting
- Insight 数字计算
- DashboardSpec 生成
- DashboardPatch 生成
- Validation（structural / semantic）
- Mock Dataset 查询
- ECharts Option 生成
- 修改 Frozen Schema

## 4. UI 唯一业务入口

```ts
import { ... } from '../application';
// 或
import { ... } from '../application/index';
```

**禁止直接 import**:
- `src/schema/`
- `src/analytics/`
- `src/data/`
- `src/registries/`
- `src/validation/`
- `src/patch/`
- `src/renderer/`

## 5. 核心类型

### DashboardRunResult

```ts
type DashboardRunResult = DashboardRunSuccess | DashboardRunFailure;
```

UI 根据 `status` 字段判断成功/失败。

### DashboardRunSuccess

```ts
interface DashboardRunSuccess {
  status: 'success';
  input: string;                    // 用户输入
  spec: DashboardSpec;              // 完整 Spec（只读，用于 Schema Inspector）
  charts: DashboardChartResult[];   // 可直接渲染的图表
  insight: DashboardInsightResult;  // 可直接展示的分析结论
  provenance: DashboardDataProvenance; // 数据来源
  trace: PipelineStepSnapshot[];    // Pipeline 执行步骤
}
```

### DashboardChartResult

```ts
interface DashboardChartResult {
  viewId: string;
  title: string;
  option: EChartsOption;  // 直接传给 ECharts 组件
}
```

UI 用法:
```tsx
{result.charts.map(chart => (
  <ReactECharts option={chart.option} />
))}
```

### DashboardInsightResult

```ts
interface DashboardInsightResult {
  intentSummary: string;           // 用户意图摘要
  items: DashboardInsightItem[];   // 具体分析结论
}
```

`items` 有两种类型:
- `RankInsightItem`: 排名类（如"跌幅最大的3天"）
- `PeriodChangeInsightItem`: 区间变化类

### DashboardRunFailure

```ts
interface DashboardRunFailure {
  status: 'error';
  input: string;
  stage: PipelineStepId;           // 失败发生在哪一步
  error: {
    code: string;                  // 错误码
    message: string;               // 用户可读中文消息
    details?: string;              // debug 用（可选展示）
    recoverable: boolean;          // 用户是否可以重试
  };
  trace: PipelineStepSnapshot[];
}
```

## 6. Pipeline Trace / Event

### Pipeline Steps

```
understand_request → build_schema → validate_schema → load_data → analyze → render
```

### PipelineStepSnapshot

```ts
interface PipelineStepSnapshot {
  id: PipelineStepId;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  message?: string;
}
```

`result.trace` 包含执行完成后的最终状态，可用于展示 Pipeline 进度。

### PipelineEvent（实时流式）

```ts
interface PipelineEvent {
  step: PipelineStepId;
  phase: 'start' | 'success' | 'error';
  message?: string;
}
```

通过 `RunOptions.onEvent` 回调接收:
```ts
const result = await service.runQuery(input, {
  onEvent: (event) => updatePipelineUI(event)
});
```

## 7. 开发阶段 vs 正式集成

### 开发阶段（当前可用）

```ts
import { getDemoFixtures } from '../application';

const fixtures = getDemoFixtures();
const g1 = fixtures[0];
// g1.initialResult = DashboardRunSuccess
// g1.followUpResult = DashboardRunResult
```

### 正式集成（Interpreter 完成后）

```ts
import { createDashboardService } from '../application';

const service = createDashboardService(interpreter);
const result = await service.runQuery(input);
```

**两者返回完全相同的 `DashboardRunResult` 类型**。
UI 代码不需要区分 fixture 和真实运行。

## 8. Error Fixtures

```ts
import { getFailureFixtures } from '../application';

const failures = getFailureFixtures();
// failures[0] = validation_error (校验失败)
// failures[1] = empty_data (数据不存在)
```

UI 应该从第一轮开发就处理这些错误状态。

## 9. 约束

### 不可修改的文件/目录

| 路径 | 说明 |
|------|------|
| `src/schema/` | Frozen Schema |
| `src/analytics/` | Analytics Engine |
| `src/data/` | Mock Dataset + Manifest |
| `src/registries/` | Instrument/Metric Registry |
| `src/validation/` | Validators |
| `src/patch/` | Patch Application |
| `src/renderer/` | ECharts Renderer Core |
| `src/application/` | Application Boundary |

### UI 应创建的目录

```
src/components/
src/pages/
src/features/dashboard-ui/
src/styles/
```

具体根据项目结构调整。

### 可序列化约束

`DashboardRunResult` 的所有字段都可以 `JSON.stringify`。
不包含 `Map`、`Set`、`Date`、`Function`、`class instance`。

### Spec 只读

`result.spec` 用于 Schema Inspector 展示。
UI 不得直接修改此对象作为业务状态。
Follow-up 必须通过 `DashboardService.runFollowUp()`。

## 10. 示例代码

### 最简渲染

```tsx
function Dashboard({ result }: { result: DashboardRunSuccess }) {
  return (
    <div>
      <h2>{result.provenance.instrument.displayName}</h2>
      <p>{result.insight.intentSummary}</p>
      {result.charts.map(chart => (
        <div key={chart.viewId}>
          <h3>{chart.title}</h3>
          <EChartsComponent option={chart.option} />
        </div>
      ))}
      <InsightPanel items={result.insight.items} />
      <PipelineTrace steps={result.trace} />
      <SchemaDrawer spec={result.spec} />
    </div>
  );
}
```

### Error State

```tsx
function ErrorView({ result }: { result: DashboardRunFailure }) {
  return (
    <div>
      <h2>分析失败</h2>
      <p>{result.error.message}</p>
      {result.error.recoverable && <button>重试</button>}
      <PipelineTrace steps={result.trace} />
    </div>
  );
}
```
