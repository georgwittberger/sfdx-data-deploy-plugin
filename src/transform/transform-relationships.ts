// tslint:disable-next-line: no-any
export default function transformRelationships(record: any): void {
  const nulledRelationships = {};
  for (const property in record) {
    if (property.endsWith('__r') && record[property] === null) {
      nulledRelationships[property.substring(0, property.lastIndexOf('__r')) + '__c'] = null;
      delete record[property];
    }
  }
  Object.assign(record, nulledRelationships);
}
