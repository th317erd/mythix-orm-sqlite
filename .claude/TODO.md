# Migrate mythix-orm-sqlite: better-sqlite3 → node:sqlite

## Tasks

- [x] 1. Update `lib/sqlite-connection.js` — import, start(), pragma(), query(), bug fix, doc comment
- [x] 2. Update `package.json` — version bump, engines, remove better-sqlite3 dep
- [x] 3. Update `spec/connection/sqlite-connection/sqlite-connection-spec.js` — exec test
- [x] 4. Clean install (`rm -rf node_modules package-lock.json && npm install`)
- [x] 5. Run tests (`npm test`) — 180 specs, 0 failures
- [x] 6. Verify no `better-sqlite3` references remain in `lib/`

## Additional fixes discovered during testing

- [x] 7. Override `generateDeleteStatement` in `sqlite-query-generator.js` to strip ORDER BY/LIMIT/OFFSET (node:sqlite's SQLite lacks `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`)
- [x] 8. Convert Uint8Array → Buffer in `formatResultsResponse` (node:sqlite returns Uint8Array for BLOBs, not Buffer)
- [x] 9. Update DELETE query generator test expectations (no ORDER BY/LIMIT/OFFSET)
