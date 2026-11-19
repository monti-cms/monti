import type { Kysely } from "kysely";
import type { Migration } from "../types";

// Each table as it is drawn in core.md, section 6: its columns, primary key and foreign keys. `media_uses.source_id` is a logical reference.

async function createFolders(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("folders")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.addColumn("scope", "text", (column) => column.notNull())
		.addColumn("parent_id", "uuid", (column) => column.references("folders.id"))
		.addColumn("name", "text", (column) => column.notNull())
		.addColumn("trashed_at", "timestamptz")
		.execute();
}

async function createEntries(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("entries")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.addColumn("collection", "text", (column) => column.notNull())
		.addColumn("source_locale", "text", (column) => column.notNull())
		.addColumn("folder_id", "uuid", (column) => column.references("folders.id"))
		.addColumn("trashed_at", "timestamptz")
		.execute();
}

/** One working copy per entry and locale; deleting the entry deletes them. */
async function createEntryLocales(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("entry_locales")
		.addColumn("entry_id", "uuid", (column) => column.notNull().references("entries.id").onDelete("cascade"))
		.addColumn("locale", "text", (column) => column.notNull())
		.addColumn("slug", "text", (column) => column.notNull())
		.addColumn("data", "jsonb", (column) => column.notNull())
		.addColumn("translation_seen", "jsonb", (column) => column.notNull())
		.addPrimaryKeyConstraint("entry_locales_pkey", ["entry_id", "locale"])
		.execute();
}

/** One published copy per working copy; deleting the working copy deletes it. */
async function createEntryPublished(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("entry_published")
		.addColumn("entry_id", "uuid", (column) => column.notNull())
		.addColumn("locale", "text", (column) => column.notNull())
		.addColumn("slug", "text", (column) => column.notNull())
		.addColumn("data", "jsonb", (column) => column.notNull())
		.addColumn("published_at", "timestamptz", (column) => column.notNull())
		.addPrimaryKeyConstraint("entry_published_pkey", ["entry_id", "locale"])
		.addForeignKeyConstraint(
			"entry_published_locale_fkey",
			["entry_id", "locale"],
			"entry_locales",
			["entry_id", "locale"],
			(constraint) => constraint.onDelete("cascade"),
		)
		.execute();
}

async function createTemplates(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("templates")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.addColumn("collection", "text", (column) => column.notNull())
		.addColumn("name", "text", (column) => column.notNull())
		.addColumn("content", "jsonb", (column) => column.notNull())
		.execute();
}

async function createMedia(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("media")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.addColumn("folder_id", "uuid", (column) => column.references("folders.id"))
		.addColumn("key", "text", (column) => column.notNull())
		.addColumn("mime_type", "text", (column) => column.notNull())
		.addColumn("metadata", "jsonb", (column) => column.notNull())
		.addColumn("trashed_at", "timestamptz")
		.execute();
}

async function createMediaUses(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("media_uses")
		.addColumn("media_id", "uuid", (column) => column.notNull().references("media.id"))
		.addColumn("source_kind", "text", (column) => column.notNull())
		.addColumn("source_id", "uuid", (column) => column.notNull())
		.addColumn("field_path", "text", (column) => column.notNull())
		.execute();
}

async function createLooseFiles(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("loose_files")
		.addColumn("key", "text", (column) => column.primaryKey())
		.addColumn("remove_after", "timestamptz", (column) => column.notNull())
		.execute();
}

async function createAdminAndSession(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("monti_admin")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.addColumn("email", "text", (column) => column.notNull())
		.addColumn("password_hash", "text", (column) => column.notNull())
		.execute();
	await db.schema
		.createTable("monti_session")
		.addColumn("token_hash", "text", (column) => column.primaryKey())
		.addColumn("admin_id", "uuid", (column) => column.notNull().references("monti_admin.id"))
		.addColumn("expires_at", "timestamptz", (column) => column.notNull())
		.execute();
}

async function createApiKeys(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("api_keys")
		.addColumn("id", "text", (column) => column.primaryKey())
		.addColumn("service", "text", (column) => column.notNull())
		.addColumn("name", "text", (column) => column.notNull())
		.addColumn("secret", "text", (column) => column.notNull())
		.addColumn("last4", "text", (column) => column.notNull())
		.execute();
}

/** Creates the eleven domain tables, referenced tables first. */
async function createDomainTables(db: Kysely<unknown>): Promise<void> {
	await createFolders(db);
	await createEntries(db);
	await createEntryLocales(db);
	await createEntryPublished(db);
	await createTemplates(db);
	await createMedia(db);
	await createMediaUses(db);
	await createLooseFiles(db);
	await createAdminAndSession(db);
	await createApiKeys(db);
}

export const initial: Migration = { name: "0001-initial", up: createDomainTables };
