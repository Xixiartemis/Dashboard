/**
 * Validation error codes and user-readable messages.
 *
 * Every validation failure maps to a stable error code + Chinese message.
 * No raw exceptions leak to consumers.
 */

export type ErrorCode =
  | 'UNKNOWN_INSTRUMENT'
  | 'UNSUPPORTED_METRIC'
  | 'INVALID_TIME_RANGE'
  | 'UNSUPPORTED_MARK'
  | 'UNKNOWN_PROPERTY'
  | 'MISSING_FIELD'
  | 'TYPE_ERROR'
  | 'INVALID_ENUM'
  | 'DUPLICATE_ID'
  | 'INVALID_UNIT'
  | 'MISSING_TRANSFORM_REF'
  | 'MISSING_SERIES_FIELD'
  | 'METRIC_MARK_INCOMPATIBLE'
  | 'TIME_RANGE_EXCEEDS_DATA'
  | 'UNRESOLVED_PROVIDER'
  | 'EMPTY_DATA'
  | 'PATCH_TARGET_NOT_FOUND'
  | 'PATCH_NEW_METRIC_INVALID'
  | 'PATCH_REVALIDATION_FAILED'
  | 'STRUCTURAL_VALIDATION_FAILED'
  | 'SEMANTIC_VALIDATION_FAILED';

export interface ValidationError {
  code: ErrorCode;
  message: string;     // Chinese, user-readable
  path?: string;       // JSON path within the spec
  details?: string;    // technical details for debugging
}

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNKNOWN_INSTRUMENT: '未知的股票标识，请检查股票代码是否正确',
  UNSUPPORTED_METRIC: '不支持的指标类型',
  INVALID_TIME_RANGE: '交易日范围无效，应在 1-60 之间',
  UNSUPPORTED_MARK: '不支持的图表类型',
  UNKNOWN_PROPERTY: '存在未知字段，不允许额外属性',
  MISSING_FIELD: '缺少必填字段',
  TYPE_ERROR: '字段类型错误',
  INVALID_ENUM: '字段值不在允许范围内',
  DUPLICATE_ID: '存在重复的 ID',
  INVALID_UNIT: '指标单位与注册表不一致',
  MISSING_TRANSFORM_REF: '引用的变换不存在',
  MISSING_SERIES_FIELD: '序列引用的字段不存在',
  METRIC_MARK_INCOMPATIBLE: '该指标不支持指定的图表类型',
  TIME_RANGE_EXCEEDS_DATA: '请求的时间范围超出可用数据',
  UNRESOLVED_PROVIDER: '数据源未解析或未注册',
  EMPTY_DATA: '查询结果为空，无可用数据',
  PATCH_TARGET_NOT_FOUND: '修改的目标指标在当前分析中不存在',
  PATCH_NEW_METRIC_INVALID: '新增指标不在指标注册表中',
  PATCH_REVALIDATION_FAILED: '修改后的看板未通过校验',
  STRUCTURAL_VALIDATION_FAILED: '结构校验失败',
  SEMANTIC_VALIDATION_FAILED: '语义校验失败',
};

export function makeError(
  code: ErrorCode,
  path?: string,
  details?: string,
): ValidationError {
  return {
    code,
    message: ERROR_MESSAGES[code],
    path,
    details,
  };
}

export function formatErrors(errors: ValidationError[]): string {
  return errors
    .map((e) => {
      const parts = [`${e.code}: ${e.message}`];
      if (e.path) parts.push(`  路径: ${e.path}`);
      if (e.details) parts.push(`  详情: ${e.details}`);
      return parts.join('\n');
    })
    .join('\n');
}
