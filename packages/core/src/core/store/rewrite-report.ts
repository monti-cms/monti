import type { RewriteReport } from "./types";

const REASON_TEXT = { unparsed: "does not parse", hash: "the content hash would change" } as const;

/** One line per body (`collection/slug (locale) state: changed|unchanged|skipped (reason)`) and a summary line. */
export function formatRewriteReport(report: RewriteReport): string[] {
	const lines = report.items.map((item) =>
		item.outcome === "skipped" && item.reason
			? `${item.label}: skipped (${REASON_TEXT[item.reason]})`
			: `${item.label}: ${item.outcome}`,
	);
	const summary = `${report.changed} changed, ${report.unchanged} unchanged, ${report.skipped} skipped`;
	lines.push(
		report.applied ? `${summary}. Written.` : `${summary}. Dry run: nothing was written (pass --apply to write).`,
	);
	return lines;
}
