import { Connection } from '@salesforce/core';
import { JobConfig } from '../config/deployment-config';
import deleteExcludedFields from './delete-excluded-fields';
import deleteMetaAttributes from './delete-meta-attributes';
import deleteSystemFields from './delete-system-fields';
import flattenNestedObjects from './flatten-nested-objects';
import transformContactAccountRelationship from './transform-contact-account-relationship';
import transformRelationships from './transform-relationships';

/**
 * Retrieve data for the given job configuration using the given JSforce connection.
 *
 * @param {Connection} connection JSforce connection.
 * @param {JobConfig} config Job configuration.
 * @returns {Promise<unknown[]>} Promise which resolves to the array of retrieved records.
 */
export default function retrieveData(connection: Connection, config: JobConfig): Promise<unknown[]> {
  return new Promise<unknown[]>((resolve, reject) => {
    const query = connection
      .sobject(config.sObjectApiName)
      .select(config.retrieveConfig?.includeFieldApiNames || ['*']);
    if (config.retrieveConfig?.filterCriteria) {
      query.where(config.retrieveConfig.filterCriteria);
    }
    if (config.retrieveConfig?.sortFieldApiNames) {
      query.sort(config.retrieveConfig.sortFieldApiNames.join(' '));
    }
    if (config.retrieveConfig?.maxRecordCount) {
      query.limit(config.retrieveConfig.maxRecordCount);
    }
    query.execute({ autoFetch: true }, (error: Error, records: unknown[]) => {
      if (error) {
        reject(error);
      } else {
        records.forEach(record => {
          deleteMetaAttributes(record);
          if (
            typeof config.retrieveConfig?.excludeSystemFields === 'undefined' ||
            config.retrieveConfig?.excludeSystemFields
          ) {
            deleteSystemFields(record);
          }
          flattenNestedObjects(record);
          transformRelationships(record);
          if (config.sObjectApiName.toLowerCase() === 'contact') {
            transformContactAccountRelationship(record);
          }
          if (config.retrieveConfig?.excludeFieldApiNames) {
            deleteExcludedFields(record, config.retrieveConfig.excludeFieldApiNames);
          }
        });
        resolve(records);
      }
    });
  });
}
