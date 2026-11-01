/**
 * What `gen-db-types.ts` cannot read from the database: the TypeScript type a column narrows to, and the note written above it in `db/database.ts`.
 * Everything else (tables, columns, base types, nullability, defaults, and the string union of a `CHECK (column IN (...))`) comes from a freshly
 * migrated schema. The generator fails on an entry here whose table or column the schema does not have.
 */

export interface ColumnNote {
	/**
	 * The column's value type in place of the one the generator derives. Only for a `text` or `uuid` column (a named string union) and a `jsonb`
	 * column (the type argument of `Jsonb`; without it the value is `unknown`). The generator adds `Generated<...>` and `| null` itself.
	 */
	readonly type?: string;
	/** One line of documentation, written as `/** ... *\/` above the column. */
	readonly note?: string;
}

/** Where the named types of `type` come from, by the import path `db/database.ts` uses. */
export const TYPE_IMPORTS: Readonly<Record<string, readonly string[]>> = {
	"../../../core/store/events": ["ContentChangeKind", "EventDeliveryState"],
	"../../../core/store/types": ["EntryMetadata", "EntryStatus", "JsonObject"],
	"./column-types": ["BigSerial", "EventPayload", "Int8", "Jsonb"],
};

/** By table, then column. */
export const COLUMN_NOTES: Readonly<Record<string, Readonly<Record<string, ColumnNote>>>> = {
	entries: {
		status: { type: "EntryStatus" },
	},
	entry_bodies: {
		metadata: { type: "EntryMetadata" },
		translation: { note: "A translation state (`readTranslation` lifts old versions); `null` for a source." },
		doc: { note: "The stored document (`readBodyDoc`)." },
		doc_key_hash: {
			note: "`documentKeyHash` of the document: what the translation filter compares a translation's base with. Written with every body.",
		},
		translation_base_hash: {
			note: "`translationBaseHash` of the translation state: the hash of the source document it was confirmed against. `null` for a source.",
		},
	},
	media_assets: {
		deleted_at: {
			note: "When the file was moved to the trash (status `trashed`); the files discarded with one folder share the folder's time.",
		},
	},
	entry_references: {
		occurrences: { note: "As stored; `readReferenceOccurrences` validates it." },
	},
	folders: {
		deleted_at: {
			note: "When the folder was moved to the trash; `null` for a live folder. What was discarded with it carries the same time.",
		},
	},
	user_preferences: {
		preferences: { type: "JsonObject" },
	},
	body_templates: {
		doc: { note: "The stored document (`readDoc`); `null` on a row written by hand." },
	},
	schema_state: {
		schema: { type: "JsonObject" },
	},
	cms_events: {
		kind: { type: "ContentChangeKind" },
		payload: { type: "EventPayload" },
	},
	cms_event_deliveries: {
		state: { type: "EventDeliveryState" },
		once_at: { note: "When `event.once` finished the subscriber's work for this event." },
	},
};
