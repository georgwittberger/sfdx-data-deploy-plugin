const defaultSystemFieldNames: string[] = [
  'Id',
  'IsDeleted',
  'MasterRecordId',
  'ParentId',
  'OwnerId',
  'CreatedDate',
  'CreatedById',
  'LastModifiedDate',
  'LastModifiedById',
  'SystemModstamp',
  'LastActivityDate',
  'LastViewedDate',
  'LastReferencedDate'
];

// tslint:disable-next-line: no-any
export default function deleteSystemFields(record: any): void {
  for (const systemFieldName of defaultSystemFieldNames) {
    delete record[systemFieldName];
  }
  for (const property in record) {
    if (!record.hasOwnProperty(property)) continue;
    if (typeof record[property] === 'object' && record[property] !== null) {
      deleteSystemFields(record[property]);
    }
  }
}
