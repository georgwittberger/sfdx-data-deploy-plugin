import { BatchInfo as JsForceBatchInfo, Job } from 'jsforce';
import { BatchInfo } from './batch-info';

/**
 * Create and executes a Bulk API batch for a single chunk of data.
 *
 * @param {Job} job Job to create the batch for.
 * @param {unknown[]} data Data to send with the batch.
 * @returns {Promise<BatchInfo>} Promise which resolves once the batch has been queued.
 */
export default function createSingleBatch(job: Job, data: unknown[]): Promise<BatchInfo> {
  return new Promise<BatchInfo>((resolve, reject) => {
    const batch = job.createBatch();
    batch.execute(data);
    job.on('error', error => reject(error));
    batch.on('error', error => reject(error));
    batch.on('queue', (batchInfo: JsForceBatchInfo) =>
      resolve({ jobId: batchInfo.jobId, batchId: batchInfo.id, state: batchInfo.state })
    );
  });
}
