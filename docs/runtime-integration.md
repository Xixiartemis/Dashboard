# Runtime Integration — Block 4

## 1. Composition Root

`src/runtime/dashboard-runtime.ts` is the only place that wires concrete implementations:

```
DeterministicInterpreter + createDashboardService() → DashboardRuntime
```

UI imports from `src/runtime/`, never from `src/interpreter/` or `src/application/` internals.

```ts
import { createRuntime } from '../runtime';
const runtime = createRuntime();
const result = await runtime.controller.submitCommand(input);
```

## 2. Runtime Controller

`src/runtime/dashboard-controller.ts` provides UI-agnostic state management:

- `submitCommand(input)` — auto-detects initial vs follow-up
- `reset()` — clears all state for new analysis
- `getState()` — current state snapshot

## 3. Initial vs Follow-up Context

| State | commandContext | submitCommand behavior |
|-------|---------------|----------------------|
| No dashboard | `initial` | `service.runQuery(input)` |
| Has dashboard | `refine` | `service.runFollowUp(spec, input)` |
| After reset | `initial` | `service.runQuery(input)` |

UI does NOT decide initial vs follow-up. Controller determines this from `lastSuccess`.

## 4. PipelineEvent Source of Truth

Events come from `RunOptions.onEvent` during real execution. The `reducePipelineEvent()` function maps events to `PipelineStepSnapshot[]` updates.

UI animation should be driven by these events, not `setTimeout`.

## 5. Follow-up Failure Preserves Dashboard

When a follow-up fails (e.g. "预测明天走势"):
- `lastSuccess` remains unchanged (previous dashboard stays visible)
- `latestError` is set to the failure
- `commandContext` stays `refine` (user can try another follow-up)

## 6. Typed Interpreter Error → DashboardRunFailure

The service uses duck typing to detect structured errors:

```ts
// InterpreterError shape: { code, message, details? }
// Detected without importing interpreter internals
if (typeof e.code === 'string' && typeof e.message === 'string') {
  code = `INTERPRETER_${e.code}`;
  message = e.message;  // preserved from interpreter
}
```

Results:
- `MISSING_INSTRUMENT` → `INTERPRETER_MISSING_INSTRUMENT` + "请指定要分析的股票"
- `UNSUPPORTED_CAPABILITY` → `INTERPRETER_UNSUPPORTED_CAPABILITY` + "当前版本暂不支持该分析能力"
- Standard `Error` → `INTERPRETER_ERROR` + generic message

## 7. Error Event Emission

Interpreter failures now emit `understand_request:error` event (not just trace update). UI sees the full lifecycle:

```
understand_request:start → understand_request:error
```

No gap in the event stream.

## 8. Fixture vs Runtime Path

| Path | Use |
|------|-----|
| `createRuntime()` → `controller.submitCommand()` | Product runtime |
| `getDemoFixtures()` | Tests, storybook, dev evidence |

Both produce `DashboardRunResult`. UI code doesn't branch on fixture vs runtime.

## 9. Observable State (subscribe)

```ts
const unsub = controller.subscribe((state) => {
  // state.running, state.pipeline, state.lastSuccess, state.latestError
  // All immutable snapshots
});
// Later:
unsub();
```

React integration:
```ts
import { useSyncExternalStore } from 'react';
const state = useSyncExternalStore(
  runtime.controller.subscribe,
  runtime.controller.getState,
  runtime.controller.getState
);
```

## 10. Race Guard

Generation token prevents stale completions from overwriting fresh state:
- `reset()` increments generation
- `submitCommand()` captures generation at start
- On completion, checks generation — stale results discarded from state

## 11. Concurrency

`submitCommand()` returns `RUNTIME_BUSY` if already running. UI should disable submit while `state.running === true`.
