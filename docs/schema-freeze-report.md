# Schema Freeze Report — DashboardSpec v1.0

## Round 1 Gate (base: 588530d)

```
DATASET_INVARIANTS=PASS
INSTRUMENT_REGISTRY=PASS
METRIC_REGISTRY=PASS
SCHEMA_STRUCTURAL_VALIDATION=PASS
SCHEMA_SEMANTIC_VALIDATION=PASS
DASHBOARD_PATCH_VALIDATION=PASS
PATCH_REVALIDATION=PASS
GOLDEN_CASES=5/5 PASS
FOLLOWUP_CASES=5/5 PASS
NEGATIVE_CASES=9/9 PASS
RENDERER_CONTRACT_PROBE=PASS
METAMORPHIC_FIXTURES=READY
REQUIREMENT_MAPPING=COMPLETE
TYPECHECK=PASS (99 tests)
LINT=PASS
BUILD=PASS
SCHEMA_FREEZE_CANDIDATE=YES
```

## Round 2: Contract Tightening (独立审计后)

### 修复的 P1 问题

| # | 问题 | 修复方式 |
|---|------|----------|
| 2 | DataSource 允许未接入的 provider | resolved=literal('embedded_mock'), priceAdjustment=literal('raw') |
| 3 | metrics 不是真正的 dependency closure | series/transform/insight 字段必须 ∈ spec.metrics |
| 4 | x-axis 允许未实现的能力 | field=literal('date'), type=literal('ordinal') |
| 5 | Renderer 接受全 null 数据 | 增加 hasFiniteValue 检查 |
| 6 | summary 可以伪装计算结果 | 改名 intentSummary，明确只表达意图 |
| 7 | Insight 和 Transform 两套排序 | rank_summary 引用 transformRef，同源 |
| 8 | Schema 声明未实现的能力 | 删除 min_volume_days |
| 9 | 手写 JSON Schema 与 Zod 漂移 | 使用 Zod 原生导出 |
| 10 | schemaVersion 太宽 | z.literal('1.0.0') |
| 11 | instrument metadata 不一致 | Semantic Validator 比对 Registry |
| 12 | Mock calendar 错标为 SSE | 改为 MOCK_WEEKDAY |
| 13 | 自定义"像 ECharts"的类型 | 加入真实 echarts 依赖 |
| 14 | 多单位合并到一个 Y 轴 | 每 distinct unit 一个 axis |

### Round 2 Gate

```
DATASET_INVARIANTS=PASS
INSTRUMENT_REGISTRY=PASS
METRIC_REGISTRY=PASS

SCHEMA_STRUCTURAL_VALIDATION=PASS
SCHEMA_SEMANTIC_VALIDATION=PASS

DATASOURCE_PROVENANCE_VALIDATION=PASS (A1-A5)
METRIC_DEPENDENCY_CLOSURE=PASS (A6-A8)
X_AXIS_CONTRACT=PASS (A9-A10)

DASHBOARD_PATCH_VALIDATION=PASS
PATCH_REVALIDATION=PASS

INSIGHT_TRANSFORM_CONSISTENCY=PASS (A15-A16)

RENDERER_CONTRACT_PROBE=PASS
ECHARTS_TYPE_CONTRACT=PASS (real echarts dependency)
MULTI_UNIT_AXIS_MAPPING=PASS (A17)

GOLDEN_CASES=5/5 PASS
FOLLOWUP_CASES=5/5 PASS
NEGATIVE_CASES=9/9 PASS
ADVERSARIAL_REGRESSION_CASES=18/18 PASS

JSON_SCHEMA_EXPORT=PASS (A18)
REQUIREMENT_MAPPING=COMPLETE

TYPECHECK=PASS (0 errors)
TESTS=PASS (106/106)
LINT=PASS (0 errors, 0 warnings)
BUILD=PASS (257ms)

P0_BLOCKERS=0
P1_BLOCKERS=0

SCHEMA_VERSION=1.0.0
SCHEMA_FREEZE_CANDIDATE=YES
```

## 自审检查清单 (Round 2)

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 交易日和自然日混淆 | ✅ | basis=trading_day, A9-A10 |
| change_pct 错误阶段计算 | ✅ | 先算后截回归测试 |
| raw/adjusted 语义 | ✅ | priceAdjustment=literal('raw'), A5 |
| 单位可能产生错误 | ✅ | Metric Registry 唯一定义，语义校验比对 |
| preference/resolved 不一致 | ✅ | resolved=literal, A1-A5 |
| metrics 与 series 职责混乱 | ✅ | A6-A8 验证 dependency closure |
| 多序列自然表达 | ✅ | G2/G5 验证 |
| Follow-up 修改已有状态 | ✅ | Patch 不重新生成 |
| Patch 后重新校验 | ✅ | applyPatch 末尾校验 |
| Schema 比 Renderer 更宽 | ✅ | x-axis literal, A9-A10 |
| 多模块重复定义 | ✅ | Metric Registry 唯一定义 |
| Insight 与图表数据不一致 | ✅ | rank_summary 同源, A15-A16 |
| Mock calendar 伪装真实 | ✅ | MOCK_WEEKDAY, foundation.test.ts |
| Renderer 只验形状不验数据 | ✅ | hasFiniteValue, A14 |
