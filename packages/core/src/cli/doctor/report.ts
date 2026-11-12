/**
 * What `monti doctor` finds and how it says it (docs/design/features/20-release.md, `monti doctor`). A check looks at one thing and says what
 * it found, where, and for a warning or a failure how to fix it, in plain words. It changes nothing and prints no secret.
 */

/**
 * `ok`: as it should be. `warn`: it works, but something should change. `fail`: the site, or a part of it, will not work. `skip`: it could
 * not be looked at, because an earlier finding blocks it.
 */
export type CheckStatus = "ok" | "warn" | "fail" | "skip";

export type CheckOutcome = {
	status: CheckStatus;
	/** What was found, in one plain sentence. */
	message: string;
	/** The file, the environment variable or the option it is in. */
	where?: string;
	/** What to do about a warning or a failure: a command where there is one. It may be several lines. */
	fix?: string;
};

/** One line of the report: a check (`database/migrations`) and what it found. */
export type CheckResult = CheckOutcome & { id: string };

export type DoctorReport = {
	/** `false` when a check failed: the command then ends with 1. Warnings do not count. */
	ok: boolean;
	/** The site's folder. */
	cwd: string;
	summary: Record<CheckStatus, number>;
	checks: CheckResult[];
};

export const ok = (message: string): CheckOutcome => ({ status: "ok", message });
export const warn = (message: string, more: Pick<CheckOutcome, "where" | "fix"> = {}): CheckOutcome => ({
	status: "warn",
	message,
	...more,
});
export const fail = (message: string, more: Pick<CheckOutcome, "where" | "fix"> = {}): CheckOutcome => ({
	status: "fail",
	message,
	...more,
});
export const skip = (message: string): CheckOutcome => ({ status: "skip", message });

export function reportOf(cwd: string, checks: CheckResult[]): DoctorReport {
	const count = (status: CheckStatus) => checks.filter((check) => check.status === status).length;
	const summary = { ok: count("ok"), warn: count("warn"), fail: count("fail"), skip: count("skip") };
	return { ok: summary.fail === 0, cwd, summary, checks };
}

const MARK: Record<CheckStatus, string> = { ok: "ok  ", warn: "warn", fail: "FAIL", skip: "skip" };

/**
 * The report as a person reads it: one line for each check with its mark, and under a warning or a failure where it is and how to fix it; the
 * counts at the end.
 */
export function formatReport(report: DoctorReport): string {
	const width = Math.max(0, ...report.checks.map((check) => check.id.length));
	const under = " ".repeat(2 + 4 + 2 + width + 2);
	const lines = [`monti doctor: ${report.cwd}`, ""];
	for (const check of report.checks) {
		const [first = "", ...rest] = check.message.split("\n");
		lines.push(`  ${MARK[check.status]}  ${check.id.padEnd(width)}  ${first}`);
		for (const line of rest) lines.push(`${under}${line}`);
		if (check.status !== "warn" && check.status !== "fail") continue;
		if (check.where) lines.push(`${under}where: ${check.where}`);
		if (check.fix) lines.push(`${under}fix:   ${check.fix.replaceAll("\n", `\n${under}       `)}`);
	}
	const { summary } = report;
	lines.push(
		"",
		`${summary.fail} failed, ${summary.warn} ${summary.warn === 1 ? "warning" : "warnings"}, ${summary.ok} ok, ${summary.skip} skipped`,
	);
	return lines.join("\n");
}
