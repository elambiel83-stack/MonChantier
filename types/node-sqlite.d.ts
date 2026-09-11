declare module 'node:sqlite' {
  export class StatementSync {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
