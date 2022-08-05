'use strict';

const { Literals }              = require('mythix-orm');
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

  generateForeignKeyConstraint(field, type) {
    let options     = type.getOptions();
    let targetModel = type.getTargetModel();
    let targetField = type.getTargetField();

    let sqlParts  = [
      'FOREIGN KEY(',
      this.escapeID(field.columnName),
      ') REFERENCES ',
      this.escapeID(targetModel.getTableName()),
      '(',
      this.escapeID(targetField.columnName),
      ')',
    ];

    if (options.deferred === true) {
      sqlParts.push(' ');
      sqlParts.push('DEFERRABLE INITIALLY DEFERRED');
    }

    if (options.onDelete) {
      sqlParts.push(' ');
      sqlParts.push(`ON DELETE ${options.onDelete.toUpperCase()}`);
    }

    if (options.onUpdate) {
      sqlParts.push(' ');
      sqlParts.push(`ON UPDATE ${options.onUpdate.toUpperCase()}`);
    }

    return sqlParts.join('');
  }

  // eslint-disable-next-line no-unused-vars
  generateCreateTableStatementInnerTail(Model, options) {
    let fieldParts = [];

    Model.iterateFields(({ field }) => {
      if (field.type.isVirtual())
        return;

      if (field.type.isForeignKey()) {
        let result = this.generateForeignKeyConstraint(field, field.type);
        if (result)
          fieldParts.push(result);

        return;
      }
    });

    return fieldParts;
  }

  generateInsertStatementTail(Model, model, options, context) {
    return this._collectReturningFields(Model, model, options, context);
  }

  generateUpdateStatementTail(Model, model, options, context) {
    return this._collectReturningFields(Model, model, options, context);
  }
}

module.exports = SQLiteQueryGenerator;
