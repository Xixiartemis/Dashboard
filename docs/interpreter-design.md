# Interpreter Design — DashboardSpec v1.0

## 为什么不让 NL 直接生成 DashboardSpec

自然语言是不确定输入（同义词、省略、歧义），而 DashboardSpec 是确定性业务 Contract。如果让 NL parser 直接输出 Spec JSON，每种语言变化都需要调整 Spec 生成逻辑，调试时无法区分"语言理解错了"还是"业务编译错了"。

因此在 NL 和 Frozen Contract 之间加入 Canonical Intent IR：

```
Natural Language
    ↓
Input Normalization (Block 2)
    ↓
Intent Extraction (Block 2)
    ↓
Semantic Resolution
    ↓
Canonical Intent IR ← 本轮建立的层
    ↓
Deterministic Compiler ← 本轮验证的层
    ↓
DashboardSpec / DashboardPatch
```

## Intent IR 的职责

Intent IR 表达"用户想做什么"，不复制 Registry metadata：

```ts
instrument: 'MOCK.A'       // canonical symbol
metrics: ['close', 'volume'] // canonical IDs
timeRange: { count: 30 }
rankings: [{ metric: 'change_pct', order: 'asc', limit: 3 }]
```

不存 `label: '收盘价'` / `unit: 'CNY'` — 这些来自 Metric Registry。

## Resolver 的职责

自然语言概念 → canonical ID：

```
'A公司' → 'MOCK.A'
'收盘价' → 'close'
'成交量' → 'volume'
```

Resolver 优先消费 Instrument Registry 的 aliases 和 Metric Resolver 的 alias mapping。不复制 Registry metadata。

## Compiler 的职责

**Spec Compiler** 是唯一知道 DashboardSpec 结构的模块：
- `schemaVersion` = literal
- `dataSource` = from MANIFEST
- `metrics[]` = from Registry
- `views[]` = from Policy (group by unit, default mark)
- `transforms[]` = from rankings
- `insight` = from rankings

**Patch Compiler** 输出 DashboardPatch，不重新生成整个 Spec：
- `replace_metric` → `{ op, from, to }`
- `add_metric` → `{ op, metric, viewId }`
- `set_time_range` → `{ op, count }`
- `set_mark` → `{ op, viewId, seriesId, mark }`

## Policy 的职责

### View Grouping
同 unit 指标放同一个 view（open+close=CNY），不同 unit 拆 view（close vs volume）。

### Default Mark
- `volume` → bar
- `change_pct` → bar
- price metrics → line
- user-specified → override

### Ranking Annotation
- `change_pct + asc` → '跌幅最大'
- `change_pct + desc` → '涨幅最大'
- `volume + desc` → '成交量最高'

### displayMetrics vs metrics
`metrics` = 全部指标（dependency closure，包含 analysis-only 如 change_pct）
`displayMetrics` = 渲染到 view 的指标子集

## Initial / Follow-up 分别编译

Initial: `ResolvedInitialIntent → DashboardSpec`（完整构建）
Follow-up: `ResolvedFollowUpIntent + currentSpec → DashboardPatch`（增量修改）

Follow-up 使用冻结的 `applyPatch()` 处理 spec mutation + validation + presentation normalization。Interpreter 不重写整个 Spec。

## Safe Default / Ambiguous / Unsupported

### Safe Default
- 无 mark → policy 决定 (line/bar)
- 无 ranking → 不生成 transform/annotation

### Ambiguous（必须 fail closed）
- 无 instrument → MISSING_INSTRUMENT
- 无 metrics → MISSING_METRICS

### Unsupported（必须 fail closed）
- 预测股价 → UNSUPPORTED_CAPABILITY
- 买入建议 → UNSUPPORTED_CAPABILITY

## Block 2: Natural Language Understanding

### Normalizer
Surface-only: fullwidth→halfwidth, whitespace (letter+CJK, CJK+digit), punctuation, synonym unification (柱形图→柱状图, 看看→查看, 改成→改为). Does NOT make semantic decisions.

### Draft Intent
Intermediate representation between extraction and resolution. Allows raw Chinese strings. Not yet canonicalized.

### Initial Extractor
Extracts structured slots from normalized text:
- instrument: regex for "X公司" / "MOCK.X"
- displayMetrics: metric patterns sorted by text position (excludes ranking phrases)
- timeRange: "最近N个交易日" / "近N天"
- mark: "折线图" / "柱状图"
- rankings: "跌幅最大的N天" / "涨幅前N" / "成交量最高的N天"

Key design: ranking patterns use `[\s，。、]*` between keyword and magnitude (not `.*?`) to prevent cross-clause bridging.

### Follow-up Extractor
Pattern-matches: replace_metric, set_time_range, set_mark, add_metric.
Order matters: check set_time_range and set_mark BEFORE replace_metric.

### Context Resolver
Maps draft + currentSpec → resolved intent. add_metric finds target view by unit. set_mark finds series by metric name.

### DeterministicInterpreter
Implements DashboardInterpreterPort. Pipeline: normalize → extract → resolve → compile.

## Registry 仍然是唯一事实来源

Interpreter 不复制 label/unit/kind/instrument metadata。
编译后的 Spec 中这些字段全部从 Registry 读取。
