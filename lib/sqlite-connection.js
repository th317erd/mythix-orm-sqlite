'use strict';

const Nife                  = require('nife');
const { DateTime }          = require('luxon');
const Database              = require('better-sqlite3');
const { Literals }          = require('mythix-orm');
const { SQLConnectionBase } = require('mythix-orm-sql-base');
const SQLiteQueryGenerator  = require('./sqlite-query-generator');

class SQLiteConnection extends SQLConnectionBase {
  static dialect = 'sqlite';

  static DefaultQueryGenerator = SQLiteQueryGenerator;

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

  getDefaultOrder(Model, _options) {
    let options = _options || {};
    let result  = super.getDefaultOrder(Model, options);
    if (result)
      return result;

    let escapedTableName  = this.escapeID(Model.getTableName(this));
    let escapedFieldName  = this.escapeID('rowid');

    return [ new Literals.Literal(`${escapedTableName}.${escapedFieldName} ${(options.reverseOrder === true) ? 'DESC' : 'ASC'}`) ];
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

  async pragma(sql) {
    if (!this.db)
      return;

    return await this.db.pragma(sql);
  }

  async enableForeignKeyConstraints(enable) {
    if (enable)
      return await this.pragma('foreign_keys = ON');
    else
      return await this.pragma('foreign_keys = OFF');
  }

  async exec(sql) {
    if (!sql)
      return;

    return await this.db.exec(sql);
  }

  async query(sql, _options) {
    if (!sql)
      return;

    let options = _options || {};
    let logger  = options.logger || (this.getOptions().logger);

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

  formatResultsResponse(sqlStatement, columns, result) {
    return {
      rows:     result,
      columns:  columns.map((column) => column.name),
    };
  }

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
