// tslint:disable-next-line: no-any
export default function transformContactAccountRelationship(record: any): void {
  if (typeof record.Account !== 'undefined') {
    record.AccountId = record.Account;
    delete record.Account;
  }
}
