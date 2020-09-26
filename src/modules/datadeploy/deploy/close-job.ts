import { Job, JobInfo } from 'jsforce';

/**
 * Closes the Bulk API job, so it cannot receive any more batches.
 *
 * @param {Job} job Bulk API job to close.
 * @returns {Promise<JobInfo>} Promise resolving to the job info.
 */
export default function closeJob(job: Job): Promise<JobInfo> {
  return job.close();
}
