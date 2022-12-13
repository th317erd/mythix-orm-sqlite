'use strict';

const { Literals }              = require('mythix-orm');
const { SQLQueryGeneratorBase } = require('mythix-orm-sql-base');

const LiteralBase = Literals.LiteralBase;

/// The query generator interface for SQLite.
///
/// See [SQLQueryGeneratorBase](https://github.com/th317erd/mythix-orm-sql-base/wiki/SQLQueryGeneratorBase)
/// for a better understanding of this class. This modifies some of
/// the methods provided by [SQLQueryGeneratorBase](https://github.com/th317erd/mythix-orm-sql-base/wiki/SQLQueryGeneratorBase)
/// for SQLite specific syntax.
///
/// Extends: [SQLQueryGeneratorBase](https://github.com/th317erd/mythix-orm-sql-base/wiki/SQLQueryGeneratorBase)
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
    return this.generateReturningClause(Model, model, options, context);
  }

  generateUpdateStatementTail(Model, model, options, context) {
    return this.generateReturningClause(Model, model, options, context);
  }

  generateConditionPostfix({ sqlOperator }) {
    if (sqlOperator === 'LIKE' || sqlOperator === 'NOT LIKE')
      return 'ESCAPE \'\\\'';

    return '';
  }

  generateSelectQueryOperatorFromQueryEngineOperator(queryPart, operator, value, valueIsReference, options) {
    let sqlOperator = super.generateSelectQueryOperatorFromQueryEngineOperator(queryPart, operator, value, valueIsReference, options);

    if ((sqlOperator === 'LIKE' || sqlOperator === 'NOT LIKE') && queryPart.caseSensitive === true)
      throw new Error(`${this.constructor.name}::generateSelectQueryOperatorFromQueryEngineOperator: "{ caseSensitive: true }" is not supported for this connection type for the "${sqlOperator}" operator.`);

    return sqlOperator;
  }

  generateDeleteStatementReturningClause(Model, queryEngine, pkField, escapedColumnName, options) {
    if (!escapedColumnName)
      return '';

    let returningField  = (pkField) ? this.getEscapedColumnName(pkField.Model, pkField, options) : '*';
    return `RETURNING ${returningField}`;
  }

  _distinctLiteralToString(literal, options) {
    if (!literal || !LiteralBase.isLiteral(literal))
      return;

    return 'DISTINCT';
  }
}

module.exports = SQLiteQueryGenerator;
