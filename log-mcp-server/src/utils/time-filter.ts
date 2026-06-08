/**
 * 时间范围过滤工具
 * 对 ISO 8601 时间戳做范围匹配
 */

export interface TimeRange {
  start: string; // ISO 8601
  end: string;   // ISO 8601
}

/**
 * 检查记录是否在指定时间范围内
 * @param record 日志记录
 * @param timeRange 时间范围（含边界）
 * @returns 是否在范围内
 */
export function isInTimeRange(
  record: Record<string, unknown>,
  timeRange: TimeRange
): boolean {
  const timestamp = record["timestamp"] as string | undefined;
  if (!timestamp) return false;

  const recordTime = new Date(timestamp).getTime();
  const startTime = new Date(timeRange.start).getTime();
  const endTime = new Date(timeRange.end).getTime();

  if (Number.isNaN(recordTime)) return false;

  return recordTime >= startTime && recordTime <= endTime;
}

/**
 * 创建时间范围过滤函数
 */
export function createTimeFilter(
  timeRange?: TimeRange
): (record: Record<string, unknown>) => boolean {
  if (!timeRange) return () => true;
  return (record) => isInTimeRange(record, timeRange);
}

/**
 * 验证时间范围是否合法（start <= end）
 */
export function isValidTimeRange(timeRange: TimeRange): boolean {
  const start = new Date(timeRange.start).getTime();
  const end = new Date(timeRange.end).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start <= end;
}
