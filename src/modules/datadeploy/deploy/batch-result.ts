import { ErrorResult, RecordResult, SuccessResult } from 'jsforce';

/**
 * Result of a Bulk API batch with separated success and error results.
 */
export interface BatchResult {
  successResults: BatchRecordSuccessResult[];
  errorResults: BatchRecordErrorResult[];
}

/**
 * Result of the deployment of a single record.
 */
export interface BatchRecordResult {
  result: RecordResult;
  record: unknown;
}
/**
 * Success result of the deployment of a single record.
 */
export interface BatchRecordSuccessResult extends BatchRecordResult {
  result: SuccessResult;
}

/**
 * Error result of the deployment of a single record.
 */
export interface BatchRecordErrorResult extends BatchRecordResult {
  result: ErrorResult;
}
