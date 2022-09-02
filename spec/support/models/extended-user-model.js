'use strict';

const { Types } = require('mythix-orm');
const User      = require('./user-model');

class ExtendedUser extends User {
  static fields = User.mergeFields({
    'id': {
      type:         Types.BIGINT,
      defaultValue: Types.BIGINT.Default.AUTO_INCREMENT,
      primaryKey:   true,
      allowNull:    false,
      unique:       true, // should be ignored when create table query is generated
    },
    'autoID': {
      type:         Types.BIGINT,
      defaultValue: Types.BIGINT.Default.AUTO_INCREMENT,
      allowNull:    false,
      unique:       true, // should be ignored when create table query is generated
    },
    'createdAt': {
      type:         Types.DATETIME('MM.DD.YYYY HH:mm:ss'),
      defaultValue: Types.DATETIME.Default.NOW,
      allowNull:    false,
    },
    'updatedAt': {
      type:         Types.DATETIME('MM.DD.YYYY HH:mm:ss'),
      defaultValue: Types.DATETIME.Default.NOW.UPDATE,
      allowNull:    false,
    },
    'email': {
      type:         Types.STRING(256),
      allowNull:    false,
      unique:       true,
    },
    'playerType': {
      type:         Types.STRING(256),
      defaultValue: 'wizard',
      allowNull:    false,
    },
  });
}

module.exports = ExtendedUser;
