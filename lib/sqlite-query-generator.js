'use strict';

const { SQLQueryGeneratorBase } = require('mythix-orm-sql-base');

class SQLiteQueryGenerator extends SQLQueryGeneratorBase {
  // eslint-disable-next-line no-unused-vars
  generateSQLJoinTypeFromQueryEngineJoinType(joinType, outer, options) {
    if (!joinType || joinType === 'inner')
      return 'INNER JOIN';
    else if (joinType === 'left')
      return 'LEFT JOIN';
    else if (joinType === 'cross')
      return 'CROSS JOIN';

    return joinType;
  }

  generateInsertStatementTail(Model, model, options, context) {
    return this._collectReturningFields(Model, model, options, context);
  }

  generateUpdateStatementTail(Model, model, options, context) {
    return this._collectReturningFields(Model, model, options, context);
  }
}

module.exports = SQLiteQueryGenerator;
