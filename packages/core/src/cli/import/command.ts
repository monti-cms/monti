import path from "node:path";
import { parseArgs } from "node:util";
import { loadApp } from "../app";
import { createClackPrompter } from "../init-prompts";
import { MAPPING_FILE } from "./mapping";
import type { Prompter } from "./prompt";
import { formatReport } from "./report";
import { ImportError, runImport } from "./run";

export interface ImportCommandIo {
	readonly cwd: string;
	readonly log: (message: string) => void;
	readonly error: (message: string) => void;
	/** The questions are put to this. Default: the terminal, when there is one. */
	readonly prompter?: Prompter;
}

export const IMPORT_HELP = `  import    Import existing .md and .mdx posts: guess the mapping, ask what is unclear, resolve links and images, write through the CMS
              <path>                Folder (or file) of posts to import
              --dry-run             Print counts, the field mapping and the problem files; write nothing
              --publish             Publish the entries whose front matter is not a draft (default: create drafts)
              --collection <name>   Send every folder to this collection
              --format <name>       Read every file with this format (default: found by the file extension)
              --mapping <file>      The mapping file (default: ./monti.import.json); it is written after the first confirmed run
              --yes                 Do not ask: take the guesses, and skip what is unclear
              --json                Print the report as JSON (implies --yes)
              --overwrite           Replace entries that were edited in the CMS since the last import
              --env-file <file>, --no-env-file, --config <file>   As for migrate
`;

/** `monti import <path> [options]`. Returns the exit code. */
export async function runImportCommand(argv: readonly string[], io: ImportCommandIo): Promise<number> {
	const { values, positionals } = parseArgs({
		args: [...argv],
		allowPositionals: true,
		options: {
			"dry-run": { type: "boolean" },
			publish: { type: "boolean" },
			collection: { type: "string" },
			format: { type: "string" },
			mapping: { type: "string" },
			yes: { type: "boolean", short: "y" },
			json: { type: "boolean" },
			overwrite: { type: "boolean" },
			"env-file": { type: "string", multiple: true },
			"no-env-file": { type: "boolean" },
			config: { type: "string" },
			help: { type: "boolean", short: "h" },
		},
	});
	if (values.help) {
		io.log(IMPORT_HELP);
		return 0;
	}
	const [target, ...extra] = positionals;
	if (!target)
		throw new ImportError(
			"usage: monti import <path> [--dry-run] [--publish] [--collection <name>] [--yes] [--json] [--mapping <file>]",
		);
	if (extra.length > 0) throw new ImportError(`monti import takes one path; got ${positionals.length}`);

	const json = values.json === true;
	const interactive =
		!values.yes && !json && (io.prompter !== undefined || (process.stdin.isTTY && process.stdout.isTTY));
	const prompter = interactive ? (io.prompter ?? (await createClackPrompter())) : undefined;
	const cms = await loadApp({
		cwd: io.cwd,
		envFiles: values["no-env-file"] ? [] : values["env-file"],
		config: values.config,
		log: json ? () => undefined : io.log,
	});
	try {
		const report = await runImport({
			cms,
			cwd: io.cwd,
			target,
			mappingFile: path.resolve(io.cwd, values.mapping ?? MAPPING_FILE),
			dryRun: values["dry-run"],
			publish: values.publish,
			overwrite: values.overwrite,
			collection: values.collection,
			format: values.format,
			prompter,
			log: io.log,
		});
		io.log(json ? JSON.stringify(report, null, 2) : formatReport(report));
		return report.counts.failed > 0 && !report.dryRun ? 1 : 0;
	} finally {
		await cms.close();
	}
}
