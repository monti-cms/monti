import type { InitReport, InitStep } from "./init-types";

/** The text of `monti init`: the progress line after the files are written, and the plain summary at the end. */

/** The progress line after the files are written: what was created and what was changed, since an edit of the person's own file is not a new file. */
export function writtenLine(report: Pick<InitReport, "created" | "overwritten" | "changed">): string {
	const files = (count: number) => `${count} file${count === 1 ? "" : "s"}`;
	const parts = [
		`Created ${files(report.created.length)}`,
		...(report.overwritten.length > 0 ? [`replaced ${report.overwritten.length}`] : []),
		...(report.changed.length > 0 ? [`changed ${report.changed.length}`] : []),
	];
	return parts.join(", ");
}

const WORDS: Record<InitStep["status"], string> = {
	done: "done",
	skipped: "skipped",
	failed: "FAILED",
	planned: "planned",
};

/** Where Monti's files go and why, so the paths in the lists below make sense. */
export const placementLine = (src: boolean): string =>
	src
		? "Your app uses src/app, so Monti's files are in src/ (next to app/)."
		: "Your app uses app/, so Monti's files are in the project root (next to app/).";

/** The plain summary: what was done, then what is left, numbered. */
export function formatInitReport(report: InitReport): string {
	const dry = report.dryRun;
	const list = (title: string, items: readonly string[]) =>
		items.length === 0 ? [] : [title, ...items.map((item) => `  - ${item}`), ""];
	const out: string[] = [];
	const failedCount = report.steps.filter((step) => step.status === "failed").length;
	out.push(
		dry
			? "Dry run: nothing was written. This is what would happen."
			: failedCount > 0
				? `Monti is only partly added: ${failedCount === 1 ? "1 step failed" : `${failedCount} steps failed`}. The files are written; the steps below did not finish.`
				: "Monti is added to your app.",
		"",
	);
	out.push(placementLine(report.app.src), "");
	out.push(
		...list(dry ? "Would create:" : "Created:", report.created),
		...(report.changed.length === 0
			? []
			: [
					dry ? "Would change:" : "Changed:",
					...report.changed.map((item) => `  - ${item.file} \u2014 ${item.change}`),
					"",
				]),
		...list(dry ? "Would replace:" : "Replaced (you said yes):", report.overwritten),
		...list("Already there, left as they are:", report.skipped),
	);
	if (report.steps.length > 0) {
		out.push("Steps:");
		for (const step of report.steps)
			out.push(`  - ${step.name}: ${WORDS[step.status]}${step.detail ? ` (${step.detail})` : ""}`);
		out.push("");
	}
	if (report.notes.length > 0) {
		out.push("Notes:", ...report.notes.map((note) => `  - ${note.replaceAll("\n", "\n    ")}`), "");
	}
	if (report.next.length > 0) {
		out.push("What is left:");
		for (const [index, step] of report.next.entries()) out.push(`  ${index + 1}. ${step.replaceAll("\n", "\n     ")}`);
	}
	return out.join("\n").trimEnd();
}
