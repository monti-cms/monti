import { appOptionsOf, defineCommand } from "./command";
import { schemaApply, schemaDiff } from "./schema-apply";
import { extractSchema, formatExtractReport } from "./schema-extract";

const SCHEMA_OPTION = {
	schema: {
		type: "string",
		value: "<file>",
		help: "Schema file (default: ./monti.schema.ts, ./src/monti.schema.ts)",
	},
} as const;

export const schemaExtractCommand = defineCommand({
	name: "schema:extract",
	summary: "Write the data part of the config file to monti.schema.ts and list what stays in code",
	options: {
		config: {
			type: "string",
			value: "<file>",
			help: "Config file (default: ./monti.config.ts, then ./cms.config.ts; each also under ./src)",
		},
		out: {
			type: "string",
			value: "<file>",
			help: "Schema file to write (default: monti.schema.ts next to the config file)",
		},
		overwrite: { type: "boolean", help: "Replace the schema file if it exists" },
		locale: {
			type: "string",
			value: "<code>",
			help: "Language for labels plugins provide (default: the admin language)",
		},
	},
	run: async (context) => {
		const report = await extractSchema({
			cwd: context.cwd,
			config: context.values.config,
			out: context.values.out,
			overwrite: context.values.overwrite,
			locale: context.values.locale,
		});
		context.log(formatExtractReport(report));
		return 0;
	},
});

export const schemaDiffCommand = defineCommand({
	name: "schema:diff",
	summary:
		"Compare the schema with the one last applied to the database and list the stored entries each change touches (read-only)",
	options: { ...SCHEMA_OPTION, check: { type: "boolean", help: "Exit 1 when there is anything to apply" } },
	app: true,
	run: async (context) => {
		const result = await schemaDiff({
			...appOptionsOf(context),
			schema: context.values.schema,
			check: context.values.check,
		});
		context.log(result.text);
		return result.exitCode;
	},
});

export const schemaApplyCommand = defineCommand({
	name: "schema:apply",
	summary:
		"Run the data transforms of the schema file (migrations) once each, record the schema, and raise schemaVersion in the file when the schema changed",
	options: {
		...SCHEMA_OPTION,
		"dry-run": { type: "boolean", help: "Run everything in a transaction that is rolled back, and write nothing" },
	},
	app: true,
	run: async (context) => {
		const outcome = await schemaApply({
			...appOptionsOf(context),
			schema: context.values.schema,
			dryRun: context.values["dry-run"],
		});
		context.log(outcome.text);
		return outcome.ok ? 0 : 1;
	},
});
