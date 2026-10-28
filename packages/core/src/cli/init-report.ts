import type { InitAnswers } from "./init-answers";
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

/** What was chosen, one line each, and the file or screen that changes it later (the language and the admin path live in `monti.schema.ts`, which the Settings screen edits). */
export function chosenLines(answers: InitAnswers): string[] {
	const [defaultLocale, ...otherLocales] = answers.locales;
	const features = answers.ai ? ["AI writing"] : [];
	return [
		`Languages: ${[`${defaultLocale} (default)`, ...otherLocales].join(", ")}. Change: admin Settings (Languages) or monti.schema.ts`,
		`Sign-in: ${answers.login === "github" ? "GitHub" : "email and password"}. Change: monti.config.ts (auth)`,
		`Image storage: ${answers.storage === "s3" ? "S3-compatible storage" : "none yet"}. Change: monti.config.ts (storage)`,
		`Extra features: ${features.length > 0 ? features.join(", ") : "none"}. Change: monti.config.ts (plugins)`,
		`Body blocks: ${answers.blocks.length > 0 ? answers.blocks.join(", ") : "none"}. Change: monti.config.ts (plugins, one line per block)`,
		`Admin path: ${answers.adminPath}. Change: monti.schema.ts (move the admin pages folder with it)`,
		`Block syntax: ${answers.directiveSyntax ? "::: blocks (directive syntax)" : "plain MDX"}. Change: monti.config.ts (the mdx() line)`,
	];
}

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
	out.push("You chose:", ...chosenLines(report.answers).map((line) => `  - ${line}`), "");
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
