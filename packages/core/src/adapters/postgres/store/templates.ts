import { randomUUID } from "node:crypto";
import { MAX_DOC_BYTES } from "../../../core/limits";
import { CmsError } from "../../../core/store/errors";
import type { BodyTemplate } from "../../../core/store/types";
import { assignBlockIds } from "../../../doc/block-ids";
import {
	canonicalDocument,
	emptyStoredDocument,
	readStoredDocument,
	type StoredDocument,
} from "../../../doc/stored-document";
import type { Site } from "../../../site";
import { type StoreContext, withTrx } from "./context";
import { isUniqueViolation } from "./errors";
import { mapTemplateRow, readDoc } from "./rows";

const COLUMNS = ["id", "name", "doc", "version", "created_at", "updated_at"] as const;

const mapTemplateError = (err: unknown) =>
	isUniqueViolation(err, ["body_templates_name_idx", "body_templates_pkey"])
		? new CmsError("Template name already exists", "conflict")
		: err;

/**
 * A template body as it is stored: a stored document, checked for its shape and put in the canonical form every body is stored in. Its blocks keep the ids of
 * `previous`, the body it replaces, where they pair up, and the others get new ones. Anything else is `invalid_input`.
 */
const storedTemplateDoc = (site: Site, value: unknown, previous?: StoredDocument | null): string => {
	let size: number;
	try {
		size = Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
	} catch {
		throw new CmsError("Template body is not a stored document", "invalid_input");
	}
	if (size > MAX_DOC_BYTES) throw new CmsError("Template body is too large", "invalid_input");
	const read = readStoredDocument(value, site);
	if (!read) throw new CmsError("Template body is not a stored document", "invalid_input");
	const doc = canonicalDocument(site, read);
	return JSON.stringify({ ...doc, content: assignBlockIds(doc.content, [previous?.content]) });
};

/**
 * Body templates, stored as documents. Picked from `새 글`; changing one does not affect entries already created.
 * The initial templates come from the site config (`seed.templates`), inserted once by a migration.
 */
export function createTemplateOps(ctx: StoreContext) {
	const { site } = ctx;
	const db = ctx.db();

	return {
		listTemplates: async (): Promise<BodyTemplate[]> => {
			const rows = await db.selectFrom("body_templates").select(COLUMNS).orderBy("created_at", "asc").execute();
			return rows.map(mapTemplateRow);
		},

		getTemplate: async (id: string): Promise<BodyTemplate> => {
			const row = await db.selectFrom("body_templates").select(COLUMNS).where("id", "=", id).executeTakeFirst();
			if (!row) throw new CmsError("Template not found", "not_found");
			return mapTemplateRow(row);
		},

		createTemplate: async (data: { name: string; doc?: unknown }): Promise<BodyTemplate> => {
			const name = (data.name || "").trim();
			if (!name) throw new CmsError("Template name is required", "invalid_input");
			const doc = storedTemplateDoc(site, data.doc === undefined ? emptyStoredDocument() : data.doc);
			const now = new Date();
			try {
				const row = await db
					.insertInto("body_templates")
					.values({ id: randomUUID(), name, doc, version: 1, created_at: now, updated_at: now })
					.returning(COLUMNS)
					.executeTakeFirstOrThrow();
				return mapTemplateRow(row);
			} catch (err) {
				throw mapTemplateError(err);
			}
		},

		updateTemplate: async (params: {
			id: string;
			expectedVersion: number;
			name?: string;
			doc?: unknown;
		}): Promise<BodyTemplate> =>
			withTrx(
				ctx,
				async (trx) => {
					const cur = await trx
						.selectFrom("body_templates")
						.select(COLUMNS)
						.where("id", "=", params.id)
						.forUpdate()
						.executeTakeFirst();
					if (!cur) throw new CmsError("Template not found", "not_found");
					if (cur.version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", cur.version);
					const name = params.name !== undefined ? params.name.trim() : cur.name;
					if (!name) throw new CmsError("Template name cannot be empty", "invalid_input");

					// A name-only update keeps the stored body as it is.
					const doc =
						params.doc === undefined
							? JSON.stringify(readDoc(cur.doc) ?? emptyStoredDocument())
							: storedTemplateDoc(site, params.doc, readDoc(cur.doc));
					const row = await trx
						.updateTable("body_templates")
						.set({ name, doc, version: cur.version + 1, updated_at: new Date() })
						.where("id", "=", params.id)
						.returning(COLUMNS)
						.executeTakeFirstOrThrow();
					return mapTemplateRow(row);
				},
				{ mapError: mapTemplateError },
			),

		deleteTemplate: async (params: { id: string; expectedVersion: number }): Promise<void> =>
			withTrx(ctx, async (trx) => {
				const cur = await trx
					.selectFrom("body_templates")
					.select("version")
					.where("id", "=", params.id)
					.forUpdate()
					.executeTakeFirst();
				if (!cur) throw new CmsError("Template not found", "not_found");
				if (cur.version !== params.expectedVersion) throw new CmsError("Conflict", "conflict", cur.version);
				await trx.deleteFrom("body_templates").where("id", "=", params.id).execute();
			}),
	};
}
