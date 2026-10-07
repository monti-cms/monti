# Kysely in the Postgres adapter

Kysely (issue #38) is adopted one module at a time. It adds type checking to the SQL of the store and keeps plain SQL where the builder is in the way. It does not
change what a query does: the store contract suite (`core/store/__test__/contract`) and the adapter tests pass unchanged after every step.

## How it fits

| Piece | Where | What it is |
| --- | --- | --- |
| `Database` | `db/database.ts` | Every table and column of the schema (all core migrations), written by hand, one file. `__test__/database-types.test.ts` compares it with `information_schema` of a freshly migrated schema, so a migration that changes a column fails until this file follows. |
| `createDb(pool, qSchema)` | `db/kysely.ts` | One Kysely instance per store (and per plugin storage) on the existing `pg.Pool`. `withSchema(qSchema)` is on it, so a query names `entries`, never the schema. It lends connections and cannot end the pool (`destroy()` is harmless). |
| `dbOn(client, qSchema)` | `db/kysely.ts` | The same schema on one `PoolClient`, cached per client. This is how Kysely joins a transaction. |
| `ctx.db(tx?)` | `store/context.ts` | `ctx.db()` is the store's pool instance, `ctx.db(client)` is `dbOn(client, ctx.qSchema)`. Modules use these two and never build an instance. |
| `withTrx(ctx, fn)` | `store/context.ts` | `withTransaction` that calls `fn(trx, client)`: `trx` is a `Db` on the transaction's client, `client` is the same `PoolClient` for code that still writes `client.query`. Options (`begin`, `mapError`) are those of `withTransaction`. |
| `titleExpr`, `translatedTitleExpr` | `store/title-sql.ts` | The title expression (`titleSql`, `translatedTitleSql`) as Kysely expressions. The text forms stay until the last module that uses them moves. |

### Transactions

A transaction is opened by `withTransaction` (a `BEGIN` on a `PoolClient`) and nothing else. `withTrx` is that function with the Kysely handle added:

```ts
await withTrx(ctx, async (trx, client) => {
	const row = await trx.selectFrom("entries").select("version").where("id", "=", id).forUpdate().executeTakeFirst();
	await client.query(`UPDATE ...`); // old code, same connection, same transaction
	await recordEvents(client, ctx.qSchema, entry, ["saved"]); // takes the client, uses dbOn inside
});
```

The Kysely handle on a client has no pool behind it: every query runs on that client, so it sees what `client.query` wrote and commits or rolls back with it.
It refuses `.transaction()` and `.startTransaction()` (an error that names `withTransaction`), because a second `BEGIN`/`COMMIT` on the same connection would end the
owner's transaction early. Code that is not in a transaction uses `ctx.db()`, whose queries each borrow a connection and give it back.

## The rules

1. **Behavior first.** A module moves with the same statements it ran before: same conditions, same order, same locks, same results. No logic is tidied in the same
   change. Check `ORDER BY` and `FOR UPDATE` first; they are what a contract test notices last.
2. **Builder by default, `sql` where the builder is in the way.** `forUpdate()`, `skipLocked()`, CTEs, `ON CONFLICT`, `RETURNING`, `UPDATE ... FROM` and `DELETE` with
   `NOT EXISTS` are builder code. Use `sql` for: `unnest(...) AS s(name)` and other set-returning functions in `FROM`, JSONB operators and builders (`->>`, `@>`,
   `jsonb_agg`, `jsonb_build_object`), `COLLATE`, `starts_with`, `to_regclass`, advisory locks and `CASE` with several arms. Give the fragment its type
   (`sql<boolean>`, `sql<string | null>`).
3. **Values are parameters, identifiers are `sql.id` / `sql.ref`, and `sql.lit` is only for keys from the site config** (as `titleSql` always did). A user value is never
   joined into SQL text.
4. **A `sql` fragment is not schema-qualified.** Inside one, name a table `sql.id(ctx.qSchema, "table")`. Outside one, the schema is applied for you.
5. **An array that may be empty is `= any(${array}::type[])`, not `in (...)`** (an empty `in ()` is a syntax error; `= any('{}')` matches nothing, which is what the old
   code did).
6. **JSONB is written as a string and read as a value.** Columns are `Jsonb<T>`: `JSON.stringify(...)` on write (as before), parsed by the driver on read. A shape that may
   be a legacy one is `unknown` and its reader validates it (`readDoc`, `readTranslation`, `readReferenceOccurrences`).
7. **`bigint` reads as a string** (`Int8`, `count(*)`): wrap it in `Number(...)` where the old code did.
8. **Errors are not wrapped.** Kysely hands back the `pg` error, so `isUniqueViolation` and the `mapError` of `withTransaction` keep working.
9. **Migrations stay plain SQL, for good.** `store/schema.ts` (the steps, `prepare`, `runOnce`) and the `*-migration.ts` data steps describe the schema as it was when they
   ran; they are not edited, and typing them against today's `Database` would be wrong. A new migration adds its column to `db/database.ts` in the same change.
10. **One module per commit, the contract suite as the safety net.** Nothing in `__test__/contract` changes in a migration PR.
11. **`kysely` stays inside `adapters/postgres`** (the import-boundary test), like `pg`.

## Modules and order

"Calls" is the number of `.query(` calls still in the module. The migration steps are not moved (rule 9).

| Module | Calls | State | PR |
| --- | ---: | --- | --- |
| `store/templates.ts` | - | done | 1 (this) |
| `plugin-storage.ts` | - | done | 1 (this) |
| `store/events.ts`, `recordEvents` (#128) | - | done | 1 (this) |
| `store/title-sql.ts` as expressions | - | done (`titleExpr`) | 1 (this) |
| `store/preferences.ts` | - | done | 2 |
| `store/folders.ts` | - | done | 2 |
| `store/media.ts` (`titleExpr`) | - | done | 2 |
| `store/public-read.ts` (uses `titleSql`, `translatedTitleSql`) | 6 | todo | 3 |
| `store/list.ts` (uses `titleSql`) | 7 | todo | 3 |
| `store/transfer.ts` | 8 | todo | 3 |
| `store/schema-change.ts` | 10 | todo | 3 |
| `store/rows.ts` helpers (`loadEntry`, `readBody`, `writeBody`, `insertReferences`, `readReferences`, `lockEntryForUpdate`) | 6 | todo | 4 |
| `store/entries.ts` (uses `titleSql`) | 15 | todo | 4 |
| `store/publish.ts` (uses `titleSql`) | 17 | todo | 4 |
| `store/lifecycle.ts` | 12 | todo | 5 |
| Cleanup: drop `titleSql` and `translatedTitleSql`, `Queryable`, `TEMPLATE_COLUMNS` and the row interfaces `Database` replaces | - | todo | 5 |
| `store/schema.ts`, `*-migration.ts`, `content-hash-backfill.ts` (migrations) | - | stays plain SQL | - |

Order: the self-contained modules first (small, few joins, no shared helpers), then the reads (they only need `titleExpr`), then the write path that shares the row helpers
(entries, publish and the helpers move together, because they run inside one transaction and share its client), then lifecycle and the cleanup. Four more PRs after this
one. A PR may split if a module turns out larger than its count says (`publish.ts` and `list.ts` are the likeliest).
