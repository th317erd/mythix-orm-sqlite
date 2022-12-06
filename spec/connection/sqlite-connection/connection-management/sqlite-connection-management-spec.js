/* eslint-disable no-magic-numbers */

'use strict';

/* global describe, expect, beforeEach */

const { Literals }          = require('mythix-orm');
const { SQLiteConnection }  = require('../../../../lib');
const { createRunners }     = require('../../../support/test-helpers');

describe('SQLiteConnection', () => {
  describe('connection management', () => {
    let connection;
    let User;
    let Role;

    // eslint-disable-next-line no-unused-vars
    const { it, fit } = createRunners(() => connection);

    beforeEach(async () => {
      connection = new SQLiteConnection({
        emulateBigIntAutoIncrement: true,
        bindModels:                 false,
        models:                     require('../../../support/models'),
      });

      let models = connection.getModels();

      User = models.User;
      Role = models.Role;
    });

    describe('getLiteralClassByName', () => {
      it('can return literal class', () => {
        expect(SQLiteConnection.getLiteralClassByName('distinct')).toBe(SQLiteConnection.Literals.DistinctLiteral);
        expect(SQLiteConnection.getLiteralClassByName('DISTINCT')).toBe(SQLiteConnection.Literals.DistinctLiteral);
        expect(SQLiteConnection.getLiteralClassByName('Distinct')).toBe(SQLiteConnection.Literals.DistinctLiteral);
        expect(SQLiteConnection.getLiteralClassByName('literal')).toBe(SQLiteConnection.Literals.Literal);
        expect(SQLiteConnection.getLiteralClassByName('LITERAL')).toBe(SQLiteConnection.Literals.Literal);
        expect(SQLiteConnection.getLiteralClassByName('base')).toBe(SQLiteConnection.Literals.LiteralBase);
      });
    });

    describe('Literal', () => {
      it('can instantiate a SQL literal', () => {
        expect(SQLiteConnection.Literal('distinct', 'User:firstName')).toBeInstanceOf(SQLiteConnection.Literals.DistinctLiteral);
      });

      it('can stringify a literal to SQL', () => {
        let literal = SQLiteConnection.Literal('distinct', 'User:firstName');
        expect(literal.toString(connection)).toEqual('DISTINCT');
      });

      it('will stringify to class name if no connection given', () => {
        let literal = SQLiteConnection.Literal('distinct', 'User:firstName');
        expect(literal.toString()).toEqual('DistinctLiteral {}');
      });
    });

    describe('escape', () => {
      it('can escape a string value', () => {
        expect(connection.escape(User.fields.id, 'test "hello";')).toEqual('\'test "hello";\'');
      });

      it('can escape a integer value', () => {
        expect(connection.escape(User.fields.id, 10)).toEqual('10');
        expect(connection.escape(User.fields.id, -10)).toEqual('-10');
      });

      it('can escape a number value', () => {
        expect(connection.escape(User.fields.id, 10.345)).toEqual('10.345');
        expect(connection.escape(User.fields.id, -10.345)).toEqual('-10.345');
      });

      it('can escape a boolean value', () => {
        expect(connection.escape(User.fields.id, true)).toEqual('TRUE');
        expect(connection.escape(User.fields.id, false)).toEqual('FALSE');
      });

      it('should not escape a literal value', () => {
        expect(connection.escape(User.fields.id, new Literals.Literal('!$#%'))).toEqual('!$#%');
      });
    });

    describe('escapeID', () => {
      it('can escape a string value', () => {
        expect(connection.escapeID('test.derp')).toEqual('"test"."derp"');
      });

      it('should not escape a literal value', () => {
        expect(connection.escapeID(new Literals.Literal('!$#%'))).toEqual('!$#%');
      });
    });

    describe('dialect', () => {
      it('can return dialect', () => {
        expect(SQLiteConnection.dialect).toEqual('sqlite');
        expect(connection.dialect).toEqual('sqlite');
      });
    });

    describe('start', () => {
      it('can initiate a :memory: DB connection', async () => {
        expect(connection.db).toBe(null);
        await connection.start();
        expect(connection.db).not.toBe(null);
      });
    });

    describe('stop', () => {
      it('can shutdown a DB connection', async () => {
        expect(connection.db).toBe(null);
        await connection.start();
        expect(connection.db).not.toBe(null);

        await connection.stop();
        expect(connection.db).toBe(null);
      });
    });

    describe('generateSavePointName', () => {
      it('can generate a save point name', async () => {
        expect(connection.generateSavePointName()).toMatch(/SP[A-P]{32}/);
      });
    });
  });
});
