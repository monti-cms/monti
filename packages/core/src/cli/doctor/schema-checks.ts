import { readFileSync } from "node:fs";
import path from "node:path";
import { hostOf } from "../../cms/host";
import { parseSchemaLiteral } from "../../schema-file/literal";
import { findSchemaFile, loadSchemaFile } from "../../schema-file/locate";
import { fail, ok, warn } from "./outcome";
import { type CoreCheck, type DoctorState, messageOf } from "./types";

/** The `schema` group of `monti doctor`: the schema file. */

const posix = (file: string) => file.split(path.sep).join("/");

const schemaFileOf = (state: DoctorState): string | undefined => {
	const fromCms = state.cms ? hostOf(state.cms).schemaFile() : undefined;
	if (fromCms) return posix(path.relative(state.cwd, fromCms));
	try {
		return findSchemaFile(state.cwd);
	} catch {
		return undefined;
	}
};

const schemaFile: CoreCheck = {
	group: "schema",
	id: "file",
	title: "Schema file",
	run: async (state) => {
		const file = schemaFileOf(state);
		if (!file) {
			if (state.cms && state.cms.site.COLLECTIONS.length > 0) {
				return ok(
					`no monti.schema.ts: the collections (${state.cms.site.COLLECTIONS.join(", ")}) are written in the config file`,
				);
			}
			return warn("no monti.schema.ts found", {
				where: state.cwd,
				fix: "`monti init` writes one; or `monti schema:extract` makes it from collections written in code",
			});
		}
		try {
			const schema = await loadSchemaFile(state.cwd, file);
			const collections = Object.keys(schema.collections ?? {});
			const summary = `${file} is valid (${collections.length} collection${collections.length === 1 ? "" : "s"}: ${collections.join(", ") || "none"})`;
			// The admin rewrites the file only when it is plain data; say when it will not.
			const literal = parseSchemaLiteral(readFileSync(path.join(state.cwd, file), "utf8"));
			return literal.ok
				? ok(summary)
				: ok(
						`${summary}; it contains code (${literal.message}), so the schema settings in the admin (Settings) are read-only for it`,
					);
		} catch (error) {
			return fail(messageOf(error), {
				where: file,
				fix: `correct the lines above in ${file}; the types of \`defineSchema\` show most of them in your editor as you type`,
			});
		}
	},
};

/** The checks of the `schema` group. */
export const SCHEMA_CHECKS: readonly CoreCheck[] = [schemaFile];
