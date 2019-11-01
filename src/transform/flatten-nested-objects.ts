// tslint:disable-next-line: no-any
export default function flattenNestedObjects(record: any): void {
  const flattenedProperties = {};
  for (const property in record) {
    if (!record.hasOwnProperty(property)) continue;
    if (typeof record[property] !== 'object' || record[property] === null) continue;
    flattenNestedObjects(record[property]);
    for (const childProperty in record[property]) {
      if (!record[property].hasOwnProperty(childProperty)) continue;
      flattenedProperties[property + '.' + childProperty] = record[property][childProperty];
    }
    delete record[property];
  }
  Object.assign(record, flattenedProperties);
}
