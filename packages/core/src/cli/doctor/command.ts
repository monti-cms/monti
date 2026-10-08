import { parseArgs } from "node:util";
import { formatDoctorReport } from "./format";
import { runDoctor } from "./run";

export const DOCTOR_HELP = `  doctor    Check the setup and say how to fix what is wrong: the config file, the schema file, the database and its migrations, the secret, the login, the Next files,
            the packages you ejected (a warning when one was ejected from a version older than the installed core), leftovers of the old setup, and the checks each plugin adds. Every warning and failure says what is wrong, where, and how to fix it. Exit code 1 when a check fails.
              --json                Print the result as JSON (for tools): { ok, cwd, online, summary, checks: [{ id, group, title, status, message, where?, fix? }] }
              --online              Also run the checks that call out over the network (the git-sync repo, the S3 bucket)
              --only <list>         Run only these checks: groups or ids, comma separated (config, database, database/migrations, git-sync, ...)
              --env-file <file>, --no-env-file, --config <file>   As for migrate
`;

/** The parts of the CLI I/O `monti doctor` uses. */
export interface DoctorCommandIo {
	readonly cwd: string;
	readonly log: (message: string) => void;
	readonly error: (message: string) => void;
}

/** `monti doctor [--json] [--online] [--only <list>] [--env-file <file>] [--no-env-file] [--config <file>]`. Returns the exit code: 1 when a check fails. */
export async function runDoctorCommand(argv: readonly string[], io: DoctorCommandIo): Promise<number> {
	const { values } = parseArgs({
		args: [...argv],
		options: {
			json: { type: "boolean" },
			online: { type: "boolean" },
			only: { type: "string" },
			"env-file": { type: "string", multiple: true },
			"no-env-file": { type: "boolean" },
			config: { type: "string" },
			help: { type: "boolean", short: "h" },
		},
	});
	if (values.help) {
		io.log(DOCTOR_HELP);
		return 0;
	}
	const only = values.only
		?.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	const report = await runDoctor({
		cwd: io.cwd,
		envFiles: values["no-env-file"] ? [] : values["env-file"],
		config: values.config,
		online: values.online,
		only,
	});
	io.log(values.json ? JSON.stringify(report, null, 2) : formatDoctorReport(report));
	return report.ok ? 0 : 1;
}
