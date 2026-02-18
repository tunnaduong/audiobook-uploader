declare module 'sql.js' {
  namespace initSqlJs {
    interface SqlJsStatic {
      Database: new (data?: ArrayLike<number>) => Database
    }

    interface Database {
      run(sql: string): void
      export(): Uint8Array
      close(): void
      prepare(sql: string): Statement
      exec(sql: string): Array<{ columns: string[]; values: any[][] }>
      getRowsModified(): number
    }

    interface Statement {
      bind(values?: any[]): boolean
      step(): boolean
      getAsObject(): Record<string, any>
      free(): boolean
    }
  }

  function initSqlJs(config?: any): Promise<any>
  export = initSqlJs
}
