import {
  createDashboardService,
  getDemoFixtures,
  getFailureFixtures,
  type DashboardService,
  type DashboardRunResult,
  type DashboardRunSuccess,
  type DashboardRunFailure,
  type PipelineEvent,
  type DemoFixture,
  type DemoFailureFixture,
  type DashboardInterpreterPort,
} from '../../application';
import type { DashboardSpec } from '../../schema/dashboard-spec';
import type { DashboardPatch } from '../../schema/dashboard-patch';

/**
 * Fixture-grounded Demo Interpreter.
 * Strictly maps the 5 Golden Cases and Follow-up Patches to their specs.
 * Future real interpreter will replace this port without touching any UI code.
 */
class DemoInterpreter implements DashboardInterpreterPort {
  private fixtures: DemoFixture[];

  constructor() {
    this.fixtures = getDemoFixtures();
  }

  async interpretInitial(input: string): Promise<DashboardSpec> {
    const trimmed = input.trim();
    // 1. Direct prompt match
    const matched = this.fixtures.find((f) => f.prompt === trimmed);
    if (matched) {
      return matched.initialResult.spec;
    }

    // 2. Fuzzy matching by key phrases
    if (trimmed.includes('跌幅最大') || (trimmed.includes('收盘价') && trimmed.includes('成交量'))) {
      return this.fixtures[0].initialResult.spec; // G1
    }
    if (trimmed.includes('开盘价') && trimmed.includes('收盘价')) {
      return this.fixtures[1].initialResult.spec; // G2
    }
    if (trimmed.includes('柱状图') || (trimmed.includes('涨跌幅') && trimmed.includes('涨幅最大'))) {
      return this.fixtures[2].initialResult.spec; // G3
    }
    if (trimmed.includes('成交量最高') || (trimmed.includes('成交量') && trimmed.includes('30'))) {
      return this.fixtures[3].initialResult.spec; // G4
    }
    if (trimmed.includes('最高价') && trimmed.includes('最低价')) {
      return this.fixtures[4].initialResult.spec; // G5
    }

    // Default to G1 for valid demo fallback
    return this.fixtures[0].initialResult.spec;
  }

  async interpretFollowUp(currentSpec: DashboardSpec, input: string): Promise<DashboardPatch> {
    const trimmed = input.trim();
    // 1. G1 Followup: 成交量 -> 涨跌幅
    if (trimmed.includes('涨跌幅') || trimmed.includes('替换') || trimmed.includes('change_pct')) {
      return {
        op: 'replace_metric',
        from: 'volume',
        to: 'change_pct',
      };
    }
    // 2. G2 Followup: 改成最近 10 个交易日
    if (trimmed.includes('10') || trimmed.includes('十')) {
      return {
        op: 'set_time_range',
        count: 10,
      };
    }
    // 3. G3 Followup: 柱状图 -> 折线图
    if (trimmed.includes('折线') || trimmed.includes('line')) {
      return {
        op: 'set_mark',
        viewId: currentSpec.views[0]?.id ?? 'change_bar',
        seriesId: currentSpec.views[0]?.series[0]?.id ?? 'change_pct_series',
        mark: 'line',
      };
    }
    // 4. G4 Followup: 改成最近 20 个交易日
    if (trimmed.includes('20') || trimmed.includes('二十')) {
      return {
        op: 'set_time_range',
        count: 20,
      };
    }
    // 5. G5 Followup: 加上收盘价
    if (trimmed.includes('收盘价') || trimmed.includes('close')) {
      return {
        op: 'add_metric',
        metric: 'close',
        viewId: currentSpec.views[0]?.id ?? 'hl_view',
      };
    }

    // Generic fallback patch: set time range to 10
    return {
      op: 'set_time_range',
      count: 10,
    };
  }
}

// Instantiate default demo service
const demoInterpreter = new DemoInterpreter();
export const defaultDashboardService: DashboardService = createDashboardService(demoInterpreter);

// Export fixtures helper
export function loadAllDemoFixtures(): {
  golden: DemoFixture[];
  failures: DemoFailureFixture[];
} {
  return {
    golden: getDemoFixtures(),
    failures: getFailureFixtures(),
  };
}
