import type { Kysely } from "kysely";
import type { Migration } from "../types";

// 각 테이블은 core.md 6절 그림 그대로다: 열, 기본 키, 외래 키. `media_uses.source_id`는 외래 키 없는 논리 참조다.

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
		.addColumn("key", "text", (column) => column.notNull().unique())
		.addColumn("filename", "text", (column) => column.notNull())
		.addColumn("mime_type", "text", (column) => column.notNull())
		.addColumn("size", "integer", (column) => column.notNull())
		.addColumn("width", "integer")
		.addColumn("height", "integer")
		.addColumn("trashed_at", "timestamptz")
		.execute();
}

/** 미디어를 영구 삭제하면 그 사용처 행도 함께 지워진다. 같은 사용처의 같은 위치에는 같은 미디어가 한 번만 기록된다. */
async function createMediaUses(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("media_uses")
		.addColumn("media_id", "uuid", (column) => column.notNull().references("media.id").onDelete("cascade"))
		.addColumn("source_kind", "text", (column) => column.notNull())
		.addColumn("source_id", "uuid", (column) => column.notNull())
		.addColumn("field_path", "text", (column) => column.notNull())
		.addPrimaryKeyConstraint("media_uses_pkey", ["media_id", "source_kind", "source_id", "field_path"])
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
		.createTable("admin")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.addColumn("email", "text", (column) => column.notNull())
		.addColumn("password_hash", "text", (column) => column.notNull())
		.execute();
	await db.schema
		.createTable("session")
		.addColumn("token_hash", "text", (column) => column.primaryKey())
		.addColumn("admin_id", "uuid", (column) => column.notNull().references("admin.id"))
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

/** 고정 도메인 테이블 8개를 참조되는 테이블부터 만든다. */
async function createDomainTables(db: Kysely<unknown>): Promise<void> {
	await createFolders(db);
	await createTemplates(db);
	await createMedia(db);
	await createMediaUses(db);
	await createLooseFiles(db);
	await createAdminAndSession(db);
	await createApiKeys(db);
}

export const initial: Migration = { name: "0001-initial", up: createDomainTables };
