/* eslint-disable indent */
/* eslint-disable no-magic-numbers */

'use strict';

/* global describe, expect, beforeAll */

const { SQLiteConnection }  = require('../../../../lib');
const { createRunners }     = require('../../../support/test-helpers');

describe('SQLiteQueryGenerator', () => {
  let connection;
  let User;
  let Role;

  // eslint-disable-next-line no-unused-vars
  const { it, fit } = createRunners(() => connection);

  beforeAll(() => {
    connection = new SQLiteConnection({
      emulateBigIntAutoIncrement: true,
      bindModels:                 false,
      models:                     require('../../../support/models'),
    });

    let models = connection.getModels();
    User = models.User;
    Role = models.Role;
  });

  describe('generateOrderClause', () => {
    const generateFieldKey = (field) => {
      return `${field.Model.getModelName()}:${field.fieldName}`;
    };

    it('can generate proper order clause', () => {
      let queryGenerator = connection.getQueryGenerator();

      let order = new Map();
      order.set(generateFieldKey(User.fields.id), { direction: '-', value: User.fields.id });

      expect(queryGenerator.generateOrderClause(order)).toEqual('ORDER BY "users"."id" DESC');
    });

    it('can generate proper order clause with a string literal', () => {
      let queryGenerator = connection.getQueryGenerator();

      let order = new Map();
      order.set(generateFieldKey(User.fields.id), { direction: '-', value: User.fields.id });
      order.set('test', { direction: '+', value: 'test' });

      expect(queryGenerator.generateOrderClause(order)).toEqual('ORDER BY "users"."id" DESC,test ASC');
    });

    it('can generate proper order clause with multiple orders', () => {
      let queryGenerator = connection.getQueryGenerator();

      let order = new Map();
      order.set(generateFieldKey(User.fields.id), { direction: '-', value: User.fields.id });
      order.set(generateFieldKey(User.fields.firstName), { direction: '+', value: User.fields.firstName });

      expect(queryGenerator.generateOrderClause(order)).toEqual('ORDER BY "users"."id" DESC,"users"."firstName" ASC');
    });

    it('should return an empty string if nothing was provided', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(queryGenerator.generateOrderClause()).toEqual('');
      expect(queryGenerator.generateOrderClause([])).toEqual('');
      expect(queryGenerator.generateOrderClause([ null, false, '' ])).toEqual('');
    });
  });

  describe('getOrderLimitOffset', () => {
    it('can get order, limit, and offset from query', () => {
      let queryGenerator = connection.getQueryGenerator();
      let result = queryGenerator.getOrderLimitOffset(User.where.primaryRoleID.EQ(1).LIMIT(100).OFFSET(5).ORDER('+id'));

      expect({
        limit:  result.limit,
        offset: result.offset,
        order:  Array.from(result.order.values()),
      }).toEqual({
        limit:  100,
        offset: 5,
        order:  [
          {
            value:     User.fields.id,
            direction: '+',
          },
        ],
      });
    });

    it('will allow limit to be infinity', () => {
      let queryGenerator = connection.getQueryGenerator();
      let result = queryGenerator.getOrderLimitOffset(User.where.primaryRoleID.EQ(1).LIMIT(Infinity).OFFSET(5).ORDER('+id'));

      expect({
        limit:  result.limit,
        offset: result.offset,
        order:  Array.from(result.order.values()),
      }).toEqual({
        limit:  Infinity,
        offset: 5,
        order:  [
          {
            value:     User.fields.id,
            direction: '+',
          },
        ],
      });
    });

    it('can order should be able to take mixed args', () => {
      let queryGenerator = connection.getQueryGenerator();
      let result = queryGenerator.getOrderLimitOffset(User.where.primaryRoleID.EQ(1).ORDER('+id', [ 'firstName' ], 'primaryRoleID').ORDER.DESC('+lastName'));

      expect({
        limit:  result.limit,
        offset: result.offset,
        order:  Array.from(result.order.values()),
      }).toEqual({
        limit:  undefined,
        offset: undefined,
        order:  [
          {
            value:     User.fields.id,
            direction: '+',
          },
          {
            value:     User.fields.firstName,
            direction: '+',
          },
          {
            value:     User.fields.primaryRoleID,
            direction: '+',
          },
          {
            value:     User.fields.lastName,
            direction: '-',
          },
        ],
      });
    });

    it('can overwrite order, limit, and offset from query', () => {
      let queryGenerator = connection.getQueryGenerator();
      let result = queryGenerator.getOrderLimitOffset(User.where.primaryRoleID.EQ(1).LIMIT(100).OFFSET(5).ORDER('+id').LIMIT(200).OFFSET(50).ORDER([ '+id' ]).ORDER.DESC('+firstName'));

      expect({
        limit:  result.limit,
        offset: result.offset,
        order:  Array.from(result.order.values()),
      }).toEqual({
        limit:  200,
        offset: 50,
        order:  [
          {
            value:     User.fields.id,
            direction: '+',
          },
          {
            value:     User.fields.firstName,
            direction: '-',
          },
        ],
      });
    });

    it('will throw error if it can not find the field', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(() => queryGenerator.getOrderLimitOffset(
        User.where
          .primaryRoleID
            .EQ(Role.where.id)
          .LIMIT(100)
          .OFFSET(5)
          .ORDER([ 'User:derp' ]),
      )).toThrow(new Error('QueryUtils::margeFields: Field "derp" not found.'));
    });
  });

  describe('generateLimitClause', () => {
    it('can generate proper limit clause', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(queryGenerator.generateLimitClause(50)).toEqual('LIMIT 50');
    });
  });

  describe('generateOffsetClause', () => {
    it('can generate proper offset clause', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(queryGenerator.generateOffsetClause(50)).toEqual('OFFSET 50');
    });
  });

  describe('generateSelectOrderLimitOffset', () => {
    it('can generate proper order clause', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(queryGenerator.generateSelectOrderLimitOffset(
        User.where
          .primaryRoleID
            .EQ(1)
          .LIMIT(100)
          .OFFSET(5)
          .ORDER.DESC([ 'id' ]),
      )).toEqual('ORDER BY "users"."id" DESC LIMIT 100 OFFSET 5');
    });

    it('can generate nothing', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(queryGenerator.generateSelectOrderLimitOffset(
        User.where
          .primaryRoleID
            .EQ(1),
      )).toEqual('ORDER BY "users"."rowid" ASC');
    });

    it('can generate proper order clause with multiple orders', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(queryGenerator.generateSelectOrderLimitOffset(
        User.where
          .primaryRoleID
            .EQ(1)
          .LIMIT(100)
          .OFFSET(5)
          .ORDER('+id').ORDER.DESC('+firstName'),
      )).toEqual('ORDER BY "users"."id" ASC,"users"."firstName" DESC LIMIT 100 OFFSET 5');
    });

    it('will ignore the limit clause when limit is Infinity', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(queryGenerator.generateSelectOrderLimitOffset(
        User.where
          .primaryRoleID
            .EQ(1)
          .LIMIT(Infinity)
          .OFFSET(5)
          .ORDER([ 'id' ]).ORDER.DESC('+firstName'),
      )).toEqual('ORDER BY "users"."id" ASC,"users"."firstName" DESC OFFSET 5');
    });

    it('will ignore the limit clause when limit is nothing', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(queryGenerator.generateSelectOrderLimitOffset(
        User.where
          .primaryRoleID
            .EQ(1)
          .OFFSET(5)
          .ORDER([ '+id' ]).ORDER.DESC('+firstName'),
      )).toEqual('ORDER BY "users"."id" ASC,"users"."firstName" DESC OFFSET 5');
    });

    it('will ignore the offset clause when offset is nothing', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(queryGenerator.generateSelectOrderLimitOffset(
        User.where
          .primaryRoleID
            .EQ(1)
          .LIMIT(10)
          .ORDER('id').ORDER.DESC('+firstName'),
      )).toEqual('ORDER BY "users"."id" ASC,"users"."firstName" DESC LIMIT 10');
    });

    it('will ignore the limit and offset clause when they are nothing', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(queryGenerator.generateSelectOrderLimitOffset(
        User.where
          .primaryRoleID
            .EQ(1)
          .ORDER('id').ORDER.DESC('+firstName'),
      )).toEqual('ORDER BY "users"."id" ASC,"users"."firstName" DESC');
    });

    it('will ignore the order clause when order is nothing', () => {
      let queryGenerator = connection.getQueryGenerator();
      expect(queryGenerator.generateSelectOrderLimitOffset(
        User.where
          .primaryRoleID
            .EQ(1)
          .LIMIT(100)
          .OFFSET(10),
      )).toEqual('ORDER BY "users"."rowid" ASC LIMIT 100 OFFSET 10');
    });
  });
});
