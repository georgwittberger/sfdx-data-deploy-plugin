// tslint:disable-next-line: no-any
export default function deleteMetaAttributes(record: any): void {
  delete record.attributes;
  for (const property in record) {
    if (!record.hasOwnProperty(property)) continue;
    if (typeof record[property] === 'object' && record[property] !== null) {
      deleteMetaAttributes(record[property]);
    }
  }
}
