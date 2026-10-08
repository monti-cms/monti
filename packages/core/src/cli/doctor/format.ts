import type { CheckStatus } from "./outcome";

/** One line of the report: a check and what it found. */
export interface DoctorResult {
	/** `<group>/<check>`, for example `database/migrations` or `auth/admins`. */
	readonly id: string;
	/** What the check belongs to: a part of the setup (`config`, `database`, ...). */
	readonly group: string;
	/** What the check looks at, in a few words. */
	readonly title: string;
	readonly status: CheckStatus;
	readonly message: string;
	readonly where?: string;
	readonly fix?: string;
}

export interface DoctorSummary {
	readonly ok: number;
	readonly warn: number;
	readonly fail: number;
	readonly skip: number;
}

/** What `monti doctor` finds, and what `--json` prints. */
export interface DoctorReport {
	/** `false` when any check failed (the exit code is 1). Warnings do not count. */
	readonly ok: boolean;
	/** The app folder. */
	readonly cwd: string;
	readonly summary: DoctorSummary;
	readonly checks: readonly DoctorResult[];
}

export function summarize(checks: readonly DoctorResult[]): DoctorSummary {
	const count = (status: CheckStatus) => checks.filter((check) => check.status === status).length;
	return { ok: count("ok"), warn: count("warn"), fail: count("fail"), skip: count("skip") };
}

const LABEL: Record<CheckStatus, string> = { ok: "ok  ", warn: "warn", fail: "FAIL", skip: "skip" };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The report as plain text: the checks grouped, each with its status, and for a warn or a fail where it is and how to fix it. */
export function formatDoctorReport(report: DoctorReport): string {
	const width = Math.max(0, ...report.checks.map((check) => check.id.length));
	const out: string[] = [`monti doctor: ${report.cwd}`, ""];
	let group: string | undefined;
	for (const check of report.checks) {
		if (check.group !== group) {
			if (group !== undefined) out.push("");
			group = check.group;
		}
		const indent = " ".repeat(2 + 4 + 2 + width + 2);
		const [first = "", ...rest] = check.message.split("\n");
		out.push(`  ${LABEL[check.status]}  ${check.id.padEnd(width)}  ${first}`);
		for (const line of rest) out.push(`${indent}${line}`);
		if (check.status === "warn" || check.status === "fail") {
			if (check.where) out.push(`${indent}where: ${check.where}`);
			if (check.fix) out.push(`${indent}fix:   ${check.fix.replaceAll("\n", `\n${indent}       `)}`);
		}
	}
	const { summary } = report;
	out.push(
		"",
		[
			`${summary.ok} ok`,
			plural(summary.warn, "warning", "warnings"),
			`${summary.fail} failed`,
			...(summary.skip > 0 ? [`${summary.skip} not checked`] : []),
		].join(", "),
	);
	if (summary.fail > 0) out.push("Fix the failed checks (marked FAIL) first, then run `monti doctor` again.");
	else if (summary.warn > 0) out.push("Nothing is broken. The warnings are worth a look before you deploy.");
	else out.push("Everything checked is in order.");
	return out.join("\n");
}
