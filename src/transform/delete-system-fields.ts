// tslint:disable-next-line: no-any
export default function deleteSystemFields(record: any): void {
  delete record.Id;
  delete record.IsDeleted;
  delete record.MasterRecordId;
  delete record.ParentId;
  delete record.OwnerId;
  delete record.CreatedDate;
  delete record.CreatedById;
  delete record.LastModifiedDate;
  delete record.LastModifiedById;
  delete record.SystemModstamp;
  for (const property in record) {
    if (!record.hasOwnProperty(property)) continue;
    if (typeof record[property] === 'object' && record[property] !== null) {
      deleteSystemFields(record[property]);
    }
  }
}
