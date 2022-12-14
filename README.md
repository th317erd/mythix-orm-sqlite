# mythix-orm-sqlite

![Mythix](docs/mythix-logo-colored.png)

SQLite database driver for [Mythix ORM](https://www.npmjs.com/package/mythix-orm).

## Install

```bash
npm i --save mythix-orm-sqlite
```

## Documentation

Documentation can be found at the [WIKI](https://github.com/th317erd/mythix-orm-sqlite/wiki).

Documentation for Mythix ORM can be found at the [Mythix ORM WIKI](https://github.com/th317erd/mythix-orm/wiki).

## Usage

```javascript
const SQLiteConnection = require('mythix-orm-sqlite');

(async function() {
  let connection = new SQLiteConnection({
    bindModels: true,
    models:     [ /* application models */ ],
    emulateBigIntAutoIncrement: true,
    foreignConstraints: true,
    logger: console,
  });

  await connection.start();

  // run application code

  await connection.stop();
})();
```

## Connection Options

| Option | Type | Default Value | Description |
| ------ | ---- | ------------- | ----------- |
| `bindModels` | `boolean` | `true` | Bind the models provided to this connection (see the Mythix ORM [Connection Binding](https://github.com/th317erd/mythix-orm/wiki/ConnectionBinding) article for more information). |
| `emulateBigIntAutoIncrement` | `boolean` | `false` | If `true`, auto-incrementing on `BIGINT` columns (which is not natively supported in SQLite) will be emulated by Mythix ORM itself. This emulation is simple, and might break during unsupported edge-cases, so think twice before using it in production code. It is primarily provided so the SQLite driver can be used seamlessly for unit testing. |
| `filename` | `string` | `':memory:'` | The file to use for the SQLite DB. Defaults to an in-memory database. |
| `foreignConstraints` | `boolean` | `true` | Enable or disable foreign key constraints. By default, foreign key constraints are not enabled in SQLite, so Mythix ORM will enable them by executing a `DB.pragma('foreign_keys = ON')` as soon as the connection is active. Setting this value to `false` will bypass this behavior, leaving SQLite with its default of not having foreign key constraints enabled. |
| `logger` | Logger Interface | `undefined` | Assign a logger to the connection. If a logger is assigned, then every query (and every error) will be logged using this logger. |
| `models` | `Array<Model>` | `undefined` | Models to register with the connection (these models will be bound to the connection if the `boundModels` option is `true`).
| `queryGenerator` | [QueryGenerator](https://github.com/th317erd/mythix-orm/wiki/QueryGeneratorBase) | [SQLiteQueryGenerator](https://github.com/th317erd/mythix-orm-sqlite/wiki/SQLiteQueryGenerator) | Provide an alternate `QueryGenerator` interface for generating SQL statements for SQLite. This is not usually needed, as the `SQLiteConnection` itself will provide its own generator interface. However, if you want to customize the default query generator, or want to provide your own, you can do so using this option. |
