# @monti-cms/core

English | [한국어](README.ko.md)

Everything Monti does is an **operation**. One definition gives an admin API route, an agent tool and a CLI command, with the same input check, version
check and activity log, so no entry point has a way around another's rules. The design is in
[`docs/design/features/00-foundation.md`](../../docs/design/features/00-foundation.md).

```ts
import { defineOperation } from "@monti-cms/core";
import { z } from "zod";

export const moveToFolder = defineOperation({
	name: "entries.moveToFolder",
	kind: "write",
	description: "Move entries into a folder.", // for the model
	input: z.object({ ids: z.array(z.string()).min(1), folderId: z.string() }),
	touches: (input) => input.ids.map((id) => ({ kind: "entry", id })), // versioned and snapshotted for undo
	check: async (input, ctx) => {/* throw CheckError to refuse */},
	run: async (input, ctx) => {/* write through ctx.db; ctx.emit(event) for receivers */},
	summary: (input) => ({ key: "entries.moveToFolder", values: { count: input.ids.length } }),
});
```

## What runs a write

`createMonti({ db, operations, recordKinds, receivers, plugins })` runs every write the same way, in one transaction:

1. The input is checked against its schema.
2. The records it `touches` are read; a version the caller read that is no longer current is a conflict (`ConflictError`).
3. `check`, then `run`.
4. One activity row, with snapshots of the touched and created records, so the write can be undone for 30 days (`activity.undo`). Undo skips a record
   changed since, and never overwrites it.
5. The events it emitted are queued for each receiver and sent only after the commit. A failed send is retried on a schedule (`RETRY_MINUTES`).

A record kind (`defineRecordKind`) tells the engine how to read a record's state and put an old state back.

## Entry points

| Entry point | Who | Writes |
|---|---|---|
| `createAdminApi(monti, { authenticate })` | the admin screen | run at once |
| `agentTools(monti)`, `callAgentTool(...)` | the assistant | become proposal items; `monti.proposals.apply` runs them later on the same path |
| `runCli(monti, argv, io)` | a developer in the terminal | run at once |

An operation marked `humanOnly` is never an agent tool. A `screen` operation is run by the browser, never by the server.

## Tests

```sh
CMS_TEST_DATABASE_URL=postgres://localhost/monti_test pnpm test
```

Each test file migrates its own schema in the test database. Test titles start with the done criterion they keep (`00-1 …`), from the feature docs.
