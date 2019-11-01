// tslint:disable-next-line: no-any
export default function deleteExcludedFields(record: any, excludedFields?: string[]): void {
  if (!excludedFields || excludedFields.length === 0) return;
  excludedFields.forEach(excludedField => delete record[excludedField]);
}
