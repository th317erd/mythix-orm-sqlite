'use strict';

const Nife                  = require('nife');
const { DateTime }          = require('luxon');
const Database              = require('better-sqlite3');
const { Literals }          = require('mythix-orm');
const { SQLConnectionBase } = require('mythix-orm-sql-base');
const SQLiteQueryGenerator  = require('./sqlite-query-generator');

/// Mythix ORM connection driver for SQLite.
///
/// This inherits from [SQLConnectionBase](https://github.com/th317erd/mythix-orm-sql-base/wiki)
/// and so gets most of its SQL functionality from its parent class.
///
/// Extends: [SQLConnectionBase](https://github.com/th317erd/mythix-orm-sql-base/wiki)
class SQLiteConnection extends SQLConnectionBase {
  static dialect = 'sqlite';

  static DefaultQueryGenerator = SQLiteQueryGenerator;

  /// Create a new `SQLiteConnection` instance.
  ///
  /// Arguments:
  ///   options?: object
  ///     Options to provide to the connection. All options are optional, though `models`
  ///     is required before the connection is used. If not provided here to the constructor,
  ///     the application models can always be provided at a later time using the
  ///     [Connection.registerModels](https://github.com/th317erd/mythix-orm/wiki/ConnectionBase#method-registerModels) method.
  ///     | Option | Type | Default Value | Description |
  ///     | ------ | ---- | ------------- | ----------- |
  ///     | `bindModels` | `boolean` | `true` | Bind the models provided to this connection (see the Mythix ORM [Connection Binding](https://github.com/th317erd/mythix-orm/wiki/ConnectionBinding) article for more information). |
  ///     | `emulateBigIntAutoIncrement` | `boolean` | `false` | If `true`, auto-incrementing on `BIGINT` columns (which is not natively supported in SQLite) will be emulated by Mythix ORM itself. This emulation is simple, and might break during unsupported edge-cases, so think twice before using it in production code. It is primarily provided so the SQLite driver can be used seamlessly for unit testing. |
  ///     | `filename` | `string` | `':memory:'` | The file to use for the SQLite DB. Defaults to an in-memory database. |
  ///     | `foreignConstraints` | `boolean` | `true` | Enable or disable foreign key constraints. By default, foreign key constraints are not enabled in SQLite, so Mythix ORM will enable them by executing a `DB.pragma('foreign_keys = ON')` as soon as the connection is active. Setting this value to `false` will bypass this behavior, leaving SQLite with its default of not having foreign key constraints enabled. |
  ///     | `logger` | Logger Interface | `undefined` | Assign a logger to the connection. If a logger is assigned, then every query (and every error) will be logged using this logger. |
  ///     | `models` | `Array<Model>` | `undefined` | Models to register with the connection (these models will be bound to the connection if the `boundModels` option is `true`).
  ///     | `queryGenerator` | [QueryGenerator](https://github.com/th317erd/mythix-orm/wiki/QueryGeneratorBase) | <see>SQLiteQueryGenerator</see> | Provide an alternate `QueryGenerator` interface for generating SQL statements for SQLite. This is not usually needed, as the `SQLiteConnection` itself will provide its own generator interface. However, if you want to customize the default query generator, or want to provide your own, you can do so using this option. |
  constructor(_options) {
    super(_options);

    if (!(_options && _options.queryGenerator))
      this.setQueryGenerator(new SQLiteQueryGenerator(this));

    Object.defineProperties(this, {
      'db': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        null,
      },
    });

    let options = this.getOptions();
    if (options.emulateBigIntAutoIncrement) {
      Object.defineProperties(this, {
        'emulatedAutoIncrementIDs': {
          writable:     true,
          enumerable:   false,
          configurable: true,
          value:        new Map(),
        },
      });
    }
  }

  /// Return the next ID for auto-increment emulation
  /// for the given `Model` and `field`.
  ///
  /// Note:
  ///   This is only used if the connection was created with the
  ///   `emulateBigIntAutoIncrement: true` option.
  ///
  /// Arguments:
  ///   Model: class [Model](https://github.com/th317erd/mythix-orm/wiki/Model)
  ///     The model that owns the field specified by the `field` argument.
  ///   field: [Field](https://github.com/th317erd/mythix-orm/wiki/Field)
  ///     The field to generate the next auto-incrementing id for.
  ///
  /// Return: number
  ///   The next auto-incrementing id for this field.
  getEmulatedAutoIncrementID(Model, field) {
    let options = this.getOptions();
    if (!(options && options.emulateBigIntAutoIncrement))
      return;

    let table = this.emulatedAutoIncrementIDs.get(Model);
    if (!table) {
      table = new Map();
      this.emulatedAutoIncrementIDs.set(Model, table);
    }

    let counter = table.get(field);
    if (!counter)
      counter = BigInt(0);

    counter = counter + BigInt(1);
    table.set(field, counter);

    return Number(counter).valueOf();
  }

  /// Reset the emulated auto-incrementing id back
  /// to `1` for the specified `field`. This is called
  /// on table truncation operations.
  ///
  /// Arguments:
  ///   Model: class [Model](https://github.com/th317erd/mythix-orm/wiki/Model)
  ///     The model that owns the field specified by the `field` argument.
  ///   field: [Field](https://github.com/th317erd/mythix-orm/wiki/Field)
  ///     The field to reset the auto-incrementing id for.
  resetEmulatedAutoIncrementID(Model, field) {
    let options = this.getOptions();
    if (!(options && options.emulateBigIntAutoIncrement))
      return;

    let table = this.emulatedAutoIncrementIDs.get(Model);
    if (!table)
      return;

    // If no field provided, then reset the entire
    // table. This is used for "truncate".
    if (!field) {
      this.emulatedAutoIncrementIDs.set(Model, new Map());
      return;
    }

    let counter = table.get(field);
    if (!counter)
      return;

    table.set(field, BigInt(0));
  }

  /// Get the default `ORDER` clause for a `SELECT` operation
  /// if none is specified by the user. This defaults to `ORDER "rowid" ASC`.
  ///
  /// Arguments:
  ///   Model: class [Model](https://github.com/th317erd/mythix-orm/wiki/Model)
  ///     The root model (aka "target model") for the `SELECT` operation.
  ///   options?: object
  ///     Options, as provided to the `SELECT` operation itself. This connection
  ///     type doesn't use these options. They are simply passed through by the
  ///     engine, primarily in case the user wants to overload this method and
  ///     needs them.
  ///
  /// Return: Map<string, { value: Field | Literal | string; direction: '+' | '-'; }>
  ///   A Map, containing all `ORDER BY` fields. The keys should be fully qualified field
  ///   names for fields, and should be the fully expanded result for literals. `string`
  ///   values are treated as literals. The `direction` option specifies the `ASC` (`'+'`)
  ///   or `DESC` (`'-'`) direction of each field in the `ORDER BY` clause.
  // eslint-disable-next-line no-unused-vars
  getDefaultOrder(Model, _options) {
    let order         = new Map();
    let fqFieldName   = `${Model.getModelName()}:rowid`;
    let fieldLiteral  = new Literals.FieldLiteral(fqFieldName, { isOrderBy: true });

    order.set(fqFieldName, {
      value:     fieldLiteral,
      direction: '+',
    });

    return order;
  }

  isStarted() {
    return !!this.db;
  }

  async start() {
    let options = this.getOptions();

    let opts = Object.assign({
      filename: ':memory:',
    }, this.getOptions());

    let db = this.db = new Database(opts.filename, opts);

    if (options.foreignConstraints !== false)
      await db.pragma('foreign_keys = ON');
  }

  async stop() {
    if (!this.db)
      return;

    await this.db.close();
    this.db = null;
  }

  getDefaultFieldValue(type, context) {
    switch (type) {
      case 'AUTO_INCREMENT': {
        let options = this.getOptions();
        let field   = context.field;

        if (field.primaryKey !== true) {
          if (!(options && options.emulateBigIntAutoIncrement))
            throw new Error('SQLiteConnection: AUTOINCREMENT isn\'t supported with BIGINT. You can silently convert to INTEGER for proper support if you pass "emulateBigIntAutoIncrement: true" to your connection options.');

          // No default for create table...
          // we will be emulating AUTOINCREMENT
          return new Literals.Literal('', { noDefaultStatementOnCreateTable: true, remote: true });
        }

        return new Literals.Literal('AUTOINCREMENT', { noDefaultStatementOnCreateTable: true, remote: true });
      }
      case 'DATETIME_NOW':
        return new Literals.Literal('(STRFTIME(\'%s\',\'now\')||SUBSTR(STRFTIME(\'%f\',\'now\'),4))', { escape: false, remote: true });
      case 'DATE_NOW':
        return new Literals.Literal('(STRFTIME(\'%s\',\'now\')||SUBSTR(STRFTIME(\'%f\',\'now\'),4))', { escape: false, remote: true });
      case 'DATETIME_NOW_LOCAL':
        return DateTime.now().toMillis();
      case 'DATE_NOW_LOCAL':
        return DateTime.now().startOf('day').toMillis();
      default:
        return type;
    }
  }

  dirtyFieldHelper({ options, field }) {
    if (!(options && options.insert))
      return;

    let connectionOptions = this.getOptions();
    if (!(connectionOptions && connectionOptions.emulateBigIntAutoIncrement))
      return;

    if (typeof field.defaultValue !== 'function')
      return;

    if (field.type.getDisplayName() !== 'BIGINT')
      return;

    if (!field.defaultValue._mythixIsAutoIncrement)
      return;

    return this.getEmulatedAutoIncrementID(field.Model, field);
  }

  /// Execute a `PRAGMA` statement in SQLite.
  ///
  /// Example:
  ///   await connection.pragma('foreign_keys = ON');
  ///
  /// Arguments:
  ///   sql: string
  ///     The `PRAGMA` statement to execute. Don't prefix the statement with
  ///     `PRAGMA`, as this method will do that automatically for you.
  ///
  /// Return: any
  ///   The raw result from the SQLite database for the `PRAGMA` statement executed.
  async pragma(sql) {
    if (!this.db)
      return;

    return await this.db.pragma(sql);
  }

  /// Enable or disable foreign key constraints.
  ///
  /// This can be useful for example if you are truncating tables.
  ///
  /// Arguments:
  ///   enable: boolean
  ///     If `true`, then foreign key constraints will be enabled, otherwise
  ///     they will be disabled.
  async enableForeignKeyConstraints(enable) {
    if (enable)
      return await this.pragma('foreign_keys = ON');
    else
      return await this.pragma('foreign_keys = OFF');
  }

  /// Execute raw SQL, including multiple statements at once.
  ///
  /// Whereas <see>SQLiteConnection.query</see> can only execute
  /// a single statement at a time, this method can execute any
  /// arbitrary SQL statement(s), including multiple statements
  /// at the same time. The result of execution is always returned
  /// raw.
  ///
  /// Arguments:
  ///   sql: string
  ///     The SQL statement(s) to execute.
  ///
  /// Return: any
  ///   The raw results from SQLite for the operation executed.
  async exec(sql) {
    if (!sql)
      return;

    return await this.db.exec(sql);
  }

  /// A raw query interface for the SQLite database.
  ///
  /// This method is used internally to execute all
  /// SQL statements generated against SQLite. For
  /// `SELECT` or `RETURNING` SQL statements, this will
  /// return the results in a formatted object: `{ rows: [ ... ], columns: [ ... ] }`.
  ///
  /// Arguments:
  ///   sql: string
  ///     The fully formed SQL statement to execute.
  ///   options?: object
  ///     Options for the operation.
  ///     | Option | Type | Default Value | Description |
  ///     | ------ | ---- | ------------- | ----------- |
  ///     | `logger` | Logger Interface | `undefined` | If provided, then the query and any errors encountered will be logged |
  ///     | `logResponse` | `boolean` | `false` | If `true`, then the response from SQLite will be logged |
  ///     | `parameters` | `Array` or `Object` | `undefined` | Parameters to bind for [better-sqlite3](https://github.com/WiseLibs/better-sqlite3/blob/HEAD/docs/api.md#binding-parameters) |
  ///
  /// Return: any
  ///   A `{ rows: [ ... ], columns: [ ... ] }` object if the statement is a
  ///   `SELECT` statement, or a statement with a `RETURNING` clause. Otherwise
  ///   the raw result from SQLite will be returned for the statement executed.
  async query(sql, _options) {
    if (!sql)
      return;

    let options = _options || {};
    let logger  = (options.logger === undefined) ? this.getOptions().logger : options.logger;

    try {
      let statement   = this.db.prepare(sql);
      let methodName  = ((/^\s*SELECT\s+|RETURNING/i).test(sql)) ? 'all' : 'run';
      let parameters  = (Nife.isNotEmpty(options.parameters)) ? [].concat(parameters) : [];

      if (logger)
        logger.log(`QUERY: ${sql}`);

      if (methodName === 'all')
        statement.raw(true);

      let result = await statement[methodName](...parameters);

      if (logger && options.logResponse)
        logger.log('QUERY RESULT: ', { columns: statement.columns(), result });

      if (methodName === 'all')
        return this.formatResultsResponse(sql, statement.columns(), result);

      return result;
    } catch (error) {
      if (logger) {
        logger.error(error);
        logger.error(`QUERY: ${sql}`);
      }

      error.query = sql;

      throw error;
    }
  }

  /// This method will start a transaction, or, if a transaction
  /// is already active, will instead start a `SAVEPOINT`.
  ///
  /// If an error is thrown in the provided `callback`, then the
  /// transaction or `SAVEPOINT` will be automatically rolled back.
  /// If the `callback` provided returns successfully, then the
  /// transaction will be committed automatically for you.
  ///
  /// Arguments:
  ///   callback: (connection: SQLiteConnection) => any
  ///     The transaction connection is passed to this callback as soon as
  ///     the transaction or `SAVEPOINT` is started. This often isn't needed
  ///     if the global [AsyncLocalStorage](https://github.com/th317erd/mythix-orm/wiki/AsyncStore) context is supported and in-use
  ///     (the default). If the [AsyncLocalStorage](https://github.com/th317erd/mythix-orm/wiki/AsyncStore) context is not in-use,
  ///     then this `connection` **must** be passed all the way through all
  ///     database calls made inside this callback.
  ///   options?: object
  ///     Options for the transaction operation. This includes the options listed below, as well as any
  ///     options that can be passed to <see>SQLiteConnection.query</see>. The `lock` options object has
  ///     one SQLite specific sub-option named `mode`, that can be one of `EXCLUSIVE` (the default),
  ///     `DEFERRED`, or `IMMEDIATE`. To understand what these do, refer to the [SQLite documentation](https://www.sqlite.org/lang_transaction.html).
  ///     | Option | Type | Default Value | Description |
  ///     | ------ | ---- | ------------- | ----------- |
  ///     | `connection` | `SQLiteConnection` | `undefined` | The connection to use for the operation. This is generally only needed if you are already inside a transaction, and need to supply the transaction connection to start a sub-transaction (a `SAVEPOINT`). |
  ///     | `lock | [Lock Mode](https://github.com/th317erd/mythix-orm/wiki/ConnectionBase#method-getLockMode) | `undefined` | Specify the lock mode for the transaction. See [ConnectionBase.getLockMode](https://github.com/th317erd/mythix-orm/wiki/ConnectionBase#method-getLockMode) for more information. |
  ///
  /// Return: any
  ///   Return the result of the provided `callback`.
  async transaction(callback, _options) {
    let options       = _options || {};
    let inheritedThis = Object.create(options.connection || this.getContextValue('connection', this));
    let lockMode      = inheritedThis.getLockMode(options.lock);
    let savePointName;

    if (lockMode && lockMode.lock)
      lockMode = lockMode.mode || 'EXCLUSIVE';
    else
      lockMode = 'DEFERRED';

    if (inheritedThis.inTransaction !== true) {
      inheritedThis.inTransaction = true;
      await inheritedThis.query(`BEGIN ${lockMode} TRANSACTION`, options);
    } else {
      savePointName = inheritedThis.generateSavePointName();
      inheritedThis.savePointName = savePointName;
      inheritedThis.isSavePoint = true;

      await inheritedThis.query(`SAVEPOINT ${savePointName}`, options);
    }

    try {
      let result = await inheritedThis.createContext(callback, inheritedThis, inheritedThis);

      if (savePointName)
        await inheritedThis.query(`RELEASE SAVEPOINT ${savePointName}`, options);
      else
        await inheritedThis.query('COMMIT', options);

      return result;
    } catch (error) {
      if (savePointName)
        await inheritedThis.query(`ROLLBACK TO SAVEPOINT ${savePointName}`, options);
      else if (inheritedThis.inTransaction)
        await inheritedThis.query('ROLLBACK', options);

      throw error;
    }
  }

  /// Format the response from SQLite for a `SELECT`
  /// or `RETURNING` statement.
  ///
  /// Arguments:
  ///   sql: string
  ///     The SQL statement that was executed.
  ///   columns: Array<object>
  ///     The columns projected, as reported by SQLite itself.
  ///   result: any
  ///     The response from SQLite.
  ///
  /// Return: { rows: Array<any>, columns: Array<string> }
  ///   The formatted response, containing all the rows returned by the query, and all
  ///   projected columns. The columns are converted to names only, so as to keep the
  ///   query interface consistent across all database drivers Mythix ORM supports.
  formatResultsResponse(sqlStatement, columns, result) {
    return {
      rows:    result,
      columns: columns.map((column) => column.name),
    };
  }

  /// Truncate a table. SQLite doesn't have a `TRUNCATE`
  /// statement, so instead this simply calls `DELETE FROM ...`
  /// to delete all rows from the table, truncating it. If
  /// BIGINT auto-increment emulation is enabled, then calling
  /// this will also reset all emulated BIGINT auto-increment
  /// counters for this table.
  ///
  /// Arguments:
  ///   Model: class [Model](https://github.com/th317erd/mythix-orm/wiki/Model)
  ///     The model whose table we should truncate.
  ///   options?: object
  ///     Any options to pass off to [ConnectionBase.destroy](https://github.com/th317erd/mythix-orm/wiki/ConnectionBase#method-destroy) and <see>SQLiteConnection.query</see>.
  ///
  /// Return: number
  ///   The number of rows deleted from the table.
  async truncate(Model, options) {
    let result = await this.destroy(Model, null, { ...(options || {}), truncate: true });

    // Update the autoincrement sequence for this table
    try {
      this.resetEmulatedAutoIncrementID(Model);

      let sqlStr = `UPDATE "sqlite_sequence" SET "seq"=0 WHERE "name"='${Model.getTableName(this)}'`;
      await this.query(sqlStr, options);
    } catch (error) {
      if (error.message !== 'no such table: sqlite_sequence')
        throw error;
    }

    return result;
  }

  // eslint-disable-next-line no-unused-vars
  _numericTypeToString(type) {
    return 'REAL';
  }

  // eslint-disable-next-line no-unused-vars
  _realTypeToString(type) {
    return 'REAL';
  }

  // eslint-disable-next-line no-unused-vars
  _dateTypeToString(type) {
    return 'BIGINT';
  }

  // eslint-disable-next-line no-unused-vars
  _datetimeTypeToString(type) {
    return 'BIGINT';
  }

  _bigintTypeToString(type, _options) {
    let options = _options || {};

    if (options.createTable && options.defaultValue === 'AUTOINCREMENT') {
      let options = this.getOptions();
      if (!(options && options.emulateBigIntAutoIncrement))
        throw new Error('SQLiteConnection: AUTOINCREMENT isn\'t supported with BIGINT. You can silently convert to INTEGER for proper support if you pass "emulateBigIntAutoIncrement: true" to your connection options.');

      return 'INTEGER';
    }

    return 'BIGINT';
  }
}

module.exports = SQLiteConnection;
