/**
 * Interpreter Errors — typed error model for the Interpreter pipeline.
 *
 * These errors represent Interpreter-level failures:
 * - Language understanding failures (future Block 2)
 * - Resolution failures (unknown instrument/metric)
 * - Policy violations (unsupported capability, ambiguity)
 * - Compiler failures (intent cannot produce valid Spec)
 *
 * They map to DashboardRunFailure at the Application boundary.
 * No raw Error / stack leaks to UI.
 */

export type InterpreterErrorCode =
  | 'UNKNOWN_INSTRUMENT'
  | 'UNKNOWN_METRIC'
  | 'AMBIGUOUS_INPUT'
  | 'UNSUPPORTED_CAPABILITY'
  | 'CONFLICTING_INTENT'
  | 'OUT_OF_RANGE'
  | 'MISSING_INSTRUMENT'
  | 'MISSING_METRICS'
  | 'COMPILATION_FAILED';

export interface InterpreterError {
  code: InterpreterErrorCode;
  message: string;       // user-readable (Chinese)
  details?: string;      // technical debug info
}

const ERROR_MESSAGES: Record<InterpreterErrorCode, string> = {
  UNKNOWN_INSTRUMENT: '无法识别的股票标识',
  UNKNOWN_METRIC: '无法识别的指标名称',
  AMBIGUOUS_INPUT: '输入信息不完整，请补充更多细节',
  UNSUPPORTED_CAPABILITY: '当前版本暂不支持该分析能力',
  CONFLICTING_INTENT: '分析意图存在矛盾',
  OUT_OF_RANGE: '参数超出允许范围',
  MISSING_INSTRUMENT: '请指定要分析的股票',
  MISSING_METRICS: '请指定要分析的指标',
  COMPILATION_FAILED: '无法生成有效的分析方案',
};

export function makeInterpreterError(
  code: InterpreterErrorCode,
  details?: string,
): InterpreterError {
  return {
    code,
    message: ERROR_MESSAGES[code],
    details,
  };
}

/** Map Interpreter error code to Application error code (for DashboardRunFailure). */
export function mapToApplicationErrorCode(
  code: InterpreterErrorCode,
): string {
  // Most interpreter errors map to a generic INTERPRETER_ERROR at the Application boundary.
  // The DashboardService error boundary handles this mapping.
  return `INTERPRETER_${code}`;
}
