import { parseArgs } from "node:util";
import { createClackPrompter, type Prompter } from "../init-prompts";
import { ejectability, ejectableNames } from "./allowlist";
import { EjectError, ejectPackage, formatEjectReport } from "./eject";
import { type FetchPackage, formatUpstreamDiff, upstreamDiff } from "./upstream-diff";

export const EJECT_HELP = `  eject     Take the source of a UI package into the site as a workspace package (packages/monti-<name>), so you can edit it. Its updates are then your job.
            Only UI packages can be ejected (${ejectableNames()}); core, auth, storage and the other data packages stay installed
            so migrations and the write pipeline keep receiving upgrades. The dependency in package.json points at the copy, and .monti/ejected.json records the version.
              <package>             The package to eject, e.g. @monti-cms/admin
              --diff <package>      Instead of ejecting: show what changed upstream since the version the package was ejected from (downloads both with npm pack)
              --to <v|path>         With --diff: the version, tag, folder or .tgz to compare with (default latest)
              --dry-run             Show what would be written and changed, and change nothing
              --yes, -y             Do not ask (asked when a person is at the terminal; without a terminal and without --yes nothing is changed)
              --no-install          Do not run the package manager's install afterwards (the command is printed)
              --json                Print the result as JSON
`;

export interface EjectCommandIo {
	readonly cwd: string;
	readonly log: (message: string) => void;
	readonly error: (message: string) => void;
	readonly prompter?: Prompter;
	/** For tests: runs the package manager. */
	readonly runInstall?: Parameters<typeof ejectPackage>[0]["runInstall"];
	/** For tests: downloads a package for `--diff`. */
	readonly fetchPackage?: FetchPackage;
}

/** `monti eject <package> [--dry-run] [--yes] [--no-install] [--json]` and `monti eject --diff <package> [--to <v>] [--json]`. Returns the exit code. */
export async function runEjectCommand(argv: readonly string[], io: EjectCommandIo): Promise<number> {
	const { values, positionals } = parseArgs({
		args: [...argv],
		allowPositionals: true,
		options: {
			diff: { type: "boolean" },
			to: { type: "string" },
			"dry-run": { type: "boolean" },
			yes: { type: "boolean", short: "y" },
			"no-install": { type: "boolean" },
			json: { type: "boolean" },
			help: { type: "boolean", short: "h" },
		},
	});
	if (values.help) {
		io.log(EJECT_HELP);
		return 0;
	}
	const [name, ...extra] = positionals;
	const fail = (message: string): number => {
		if (values.json) io.log(JSON.stringify({ ok: false, error: message }, null, 2));
		else io.error(message);
		return 1;
	};
	if (!name || extra.length > 0) {
		return fail(`Name one package to eject: monti eject <package>. These can be ejected: ${ejectableNames()}.`);
	}
	try {
		if (values.diff) {
			const result = await upstreamDiff({ cwd: io.cwd, name, to: values.to, fetchPackage: io.fetchPackage });
			io.log(values.json ? JSON.stringify({ ok: true, ...result }, null, 2) : formatUpstreamDiff(result));
			return 0;
		}
		// Refuse before asking anything.
		const verdict = ejectability(name);
		if (!verdict.ok) return fail(verdict.reason);
		const interactive =
			!values.yes && !values["dry-run"] && !values.json && Boolean(process.stdin.isTTY && process.stdout.isTTY);
		const report = await ejectPackage({
			cwd: io.cwd,
			name,
			dryRun: values["dry-run"],
			yes: values.yes,
			install: !values["no-install"],
			runInstall: io.runInstall,
			prompter: io.prompter ?? (interactive ? await createClackPrompter() : undefined),
		});
		io.log(values.json ? JSON.stringify({ ok: true, ...report }, null, 2) : formatEjectReport(report));
		return 0;
	} catch (error) {
		if (error instanceof EjectError) return fail(error.message);
		throw error;
	}
}
