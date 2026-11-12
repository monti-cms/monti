import { formatReport } from "./report";
import { type DoctorOptions, runDoctor } from "./run";

/**
 * `monti doctor [--json] [--origin <address>]`: prints what it found and ends with 1 when a check failed, so a deploy can stop on it. Warnings
 * do not fail it. `--json` prints the same report as JSON.
 */
export async function doctor(
	options: Omit<DoctorOptions, "origin"> & { argv: string[]; out?: (line: string) => void },
): Promise<number> {
	const { argv, out = (line: string) => console.log(line), ...rest } = options;
	const at = argv.indexOf("--origin");
	const origin = at >= 0 ? argv[at + 1] : rest.env.SITE_URL;
	const report = await runDoctor({ ...rest, origin: origin?.replace(/\/$/, "") });
	out(argv.includes("--json") ? JSON.stringify(report, null, "\t") : formatReport(report));
	return report.ok ? 0 : 1;
}
