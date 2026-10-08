import type { FieldTarget, ImportMapping } from "./mapping";
import { fieldOfTarget, reservedOf } from "./mapping";
import type { NoticeKind } from "./plan";

/** What an import (or a dry run) found and did, and how it reads. */

export type FileStatus = "imported" | "updated" | "skipped" | "failed";

export interface FileNotice {
	readonly kind: NoticeKind;
	readonly message: string;
}

export interface FileResult {
	/** Path of the file relative to the working directory. */
	readonly path: string;
	readonly status: FileStatus;
	/** Why: what happened to the file, in a sentence. */
	readonly reason: string;
	readonly collection?: string;
	readonly locale?: string;
	readonly slug?: string;
	readonly entryId?: string;
	/** Whether the entry is published after the run (`draft` when it is not). */
	readonly state?: "draft" | "published";
	/** Things that did not stop the file but that the person should know. */
	readonly notices: readonly FileNotice[];
}

export interface CollectionCounts {
	files: number;
	imported: number;
	updated: number;
	skipped: number;
	failed: number;
	/** Files in a language other than the default one. */
	translations: number;
}

/** A file in a language other than the default one, which is joined to the entry of its source instead of making an entry of its own. */
export interface TranslationJoin {
	readonly path: string;
	readonly collection: string;
	readonly locale: string;
	/** The address of the entry it joins (the address of its source). */
	readonly slug: string;
}

export interface ImportReport {
	readonly dryRun: boolean;
	readonly path: string;
	readonly publish: boolean;
	/** The mapping file, and whether this run wrote it. */
	readonly mappingFile: string;
	readonly mappingSaved: boolean;
	readonly mapping: ImportMapping;
	readonly files: readonly FileResult[];
	readonly counts: { imported: number; updated: number; skipped: number; failed: number };
	readonly collections: Readonly<Record<string, CollectionCounts>>;
	/** The files that are translations of another file, and which entry each joins. */
	readonly translations: readonly TranslationJoin[];
	/** Entries created for the values of relation fields (tags), by collection. */
	readonly createdTargets: Readonly<Record<string, readonly string[]>>;
	readonly media: {
		uploaded: number;
		reused: number;
		wouldUpload: number;
		/** Without storage: the local images that were left as they are. */
		left: number;
		configured: boolean;
	};
	readonly links: { resolved: number; unresolved: number };
	/** Decisions the run took without asking, worth reading. */
	readonly notes: readonly string[];
	/** The summary in plain words. */
	readonly summary: string;
}

const plural = (count: number, word: string) =>
	`${count} ${count === 1 ? word : word.endsWith("y") ? `${word.slice(0, -1)}ies` : `${word}s`}`;

/** The summary in plain words. */
export function summarize(report: Omit<ImportReport, "summary">): string {
	const { counts, dryRun, publish } = report;
	const total = report.files.length;
	const parts = [
		counts.imported > 0 ? `${dryRun ? "would import" : "imported"} ${plural(counts.imported, "new file")}` : "",
		counts.updated > 0 ? `${dryRun ? "would update" : "updated"} ${plural(counts.updated, "file")}` : "",
		counts.skipped > 0 ? `${dryRun ? "would skip" : "skipped"} ${plural(counts.skipped, "file")}` : "",
		counts.failed > 0 ? `${plural(counts.failed, "file")} ${dryRun ? "would fail" : "failed"}` : "",
	].filter(Boolean);
	const lead = `${dryRun ? "Dry run: nothing was written. Of" : "Of"} ${plural(total, "file")}, ${parts.length > 0 ? parts.join(", ") : "nothing to do"}.`;
	const drafts = report.files.filter(
		(file) => file.state === "draft" && (file.status === "imported" || file.status === "updated"),
	).length;
	const tail: string[] = [];
	if (drafts > 0 && !publish) {
		tail.push(
			`${plural(drafts, "entry")} ${dryRun ? "would be" : "are"} drafts. Run again with --publish to publish the ones whose front matter is not a draft.`,
		);
	}
	if (dryRun) tail.push("Run it again without --dry-run to import.");
	if (counts.failed > 0)
		tail.push(
			"The failed files are listed with the reason; fix them and run the command again, only they will be tried.",
		);
	if (counts.imported + counts.updated + counts.skipped + counts.failed === 0)
		tail.push("There was nothing to import.");
	return [lead, ...tail].join(" ");
}

function describeTarget(value: FieldTarget, labels: (field: string) => string): string {
	const reserved = reservedOf(value);
	if (reserved === "@publishedAt") return "the publish date";
	if (reserved === "@slug") return "the address";
	if (reserved === "@locale") return "the language";
	if (reserved === "@draft") return "draft when true";
	if (reserved === "@published") return "draft when false";
	if (reserved === "@skip") return "(skipped)";
	const named = fieldOfTarget(value);
	if (!named) return "(skipped)";
	return `${labels(named.field)}${typeof value !== "string" && value.create ? " (missing ones are created)" : ""}`;
}

/** The mapping as a short table the person can confirm. */
export function describeMapping(mapping: ImportMapping): string[] {
	const lines: string[] = [];
	for (const [place, entry] of Object.entries(mapping.folders)) {
		lines.push(entry.collection === null ? `${place}  ->  (not imported)` : `${place}  ->  ${entry.collection}`);
		for (const [key, value] of Object.entries(entry.fields)) {
			lines.push(`    ${key}  ->  ${describeTarget(value, (field) => field)}`);
		}
	}
	if (mapping.locale && mapping.locale.from.length > 0) {
		lines.push(`language: from ${mapping.locale.from.join(", ")}`);
	}
	if (mapping.publicDir) lines.push(`images: looked up in ${mapping.publicDir} (and next to the posts)`);
	return lines;
}

const NOTICE_LABEL: Readonly<Record<NoticeKind, string>> = {
	parse_error: "parse error",
	front_matter: "front matter",
	no_format: "no format",
	no_collection: "no collection",
	unknown_locale: "unknown language",
	no_source: "no source",
	duplicate_slug: "duplicate address",
	unknown_field: "unknown field",
	missing_required: "missing required",
	invalid_value: "invalid value",
	link: "link",
	image: "image",
	relation: "relation",
	date: "date",
	translation: "translation",
	publish: "not published",
};

/** `1 translation (en of notes) joined to its source`, or the plural, with the first few named. */
export function describeTranslations(translations: readonly TranslationJoin[]): string | undefined {
	if (translations.length === 0) return undefined;
	const shown = translations.slice(0, 5).map((item) => `${item.locale} of ${item.slug}`);
	const more = translations.length > shown.length ? `, and ${translations.length - shown.length} more` : "";
	const one = translations.length === 1;
	return `${plural(translations.length, "translation")} (${shown.join(", ")}${more}) joined to ${one ? "its source" : "their sources"}`;
}

/** A notice that comes back, word for word, in several files. */
interface RepeatedNotice {
	readonly kind: NoticeKind;
	readonly message: string;
	readonly files: readonly string[];
}

/** How many files must share a notice before it is told once instead of under each file. */
const REPEAT_FROM = 3;

/** Splits the notices of the files into the ones that repeat across files (told once) and the rest (told under their file). */
function groupNotices(files: readonly FileResult[]): {
	readonly repeated: readonly RepeatedNotice[];
	readonly rest: (file: FileResult) => readonly FileNotice[];
} {
	const seen = new Map<string, RepeatedNotice & { files: string[] }>();
	for (const file of files) {
		for (const notice of file.notices) {
			const key = `${notice.kind}\u0000${notice.message}`;
			const entry = seen.get(key) ?? { kind: notice.kind, message: notice.message, files: [] };
			if (!entry.files.includes(file.path)) entry.files.push(file.path);
			seen.set(key, entry);
		}
	}
	const repeated = [...seen.values()].filter((entry) => entry.files.length >= REPEAT_FROM);
	const repeatedKeys = new Set(repeated.map((entry) => `${entry.kind}\u0000${entry.message}`));
	return {
		repeated,
		rest: (file) => file.notices.filter((notice) => !repeatedKeys.has(`${notice.kind}\u0000${notice.message}`)),
	};
}

const repeatedLines = (repeated: readonly RepeatedNotice[]): string[] =>
	repeated.flatMap((entry) => {
		const names = entry.files.slice(0, 3).join(", ");
		const more = entry.files.length > 3 ? `, and ${entry.files.length - 3} more` : "";
		return [`  ${NOTICE_LABEL[entry.kind]}: ${entry.message} (${plural(entry.files.length, "file")}: ${names}${more})`];
	});

/** The report as text, for a terminal. */
export function formatReport(report: ImportReport): string {
	const lines: string[] = [];
	const tense = (done: string, would: string) => (report.dryRun ? would : done);

	if (report.dryRun) {
		lines.push("Dry run: nothing is written.", "");
		lines.push("By collection:");
		for (const [name, c] of Object.entries(report.collections)) {
			lines.push(
				`  ${name}: ${plural(c.files, "file")} (${c.imported} new, ${c.updated} to update, ${c.skipped} unchanged or skipped, ${c.failed} with errors${c.translations > 0 ? `, ${plural(c.translations, "translation")}` : ""})`,
			);
		}
		lines.push("", "Field mapping:", ...describeMapping(report.mapping).map((line) => `  ${line}`));
		const targets = Object.entries(report.createdTargets);
		if (targets.length > 0) {
			lines.push("", "Would create:");
			for (const [collection, names] of targets) lines.push(`  ${collection}: ${names.join(", ")}`);
		}
		if (report.media.configured) {
			lines.push("", `Images: ${report.media.wouldUpload} to upload, ${report.media.reused} already uploaded.`);
		}
		const translated = describeTranslations(report.translations);
		if (translated) lines.push("", `Translations: ${translated}.`);
		const grouped = groupNotices(report.files);
		if (grouped.repeated.length > 0) lines.push("", "Repeated in several files:", ...repeatedLines(grouped.repeated));
		const problems = report.files.filter((file) => file.status === "failed" || grouped.rest(file).length > 0);
		lines.push("", problems.length > 0 ? "Problem files:" : "Problem files: none");
		for (const file of problems) {
			lines.push(`  ${file.path}`);
			if (file.status === "failed") lines.push(`    error: ${file.reason}`);
			for (const notice of grouped.rest(file)) lines.push(`    ${NOTICE_LABEL[notice.kind]}: ${notice.message}`);
		}
	} else {
		const sections: [FileStatus, string][] = [
			["imported", tense("Imported", "Would import")],
			["updated", tense("Updated", "Would update")],
			["skipped", tense("Skipped", "Would skip")],
			["failed", tense("Failed", "Would fail")],
		];
		const grouped = groupNotices(report.files);
		for (const [status, title] of sections) {
			const files = report.files.filter((file) => file.status === status);
			if (files.length === 0) continue;
			lines.push(`${title} (${files.length}):`);
			for (const file of files) {
				lines.push(`  ${file.path}: ${file.reason}`);
				for (const notice of grouped.rest(file)) lines.push(`    ${NOTICE_LABEL[notice.kind]}: ${notice.message}`);
			}
			lines.push("");
		}
		if (grouped.repeated.length > 0) lines.push("Repeated in several files:", ...repeatedLines(grouped.repeated), "");
		const translated = describeTranslations(report.translations);
		if (translated) lines.push(`Translations: ${translated}.`, "");
		const targets = Object.entries(report.createdTargets);
		for (const [collection, names] of targets) lines.push(`Created ${collection}: ${names.join(", ")}`);
		if (report.media.uploaded > 0 || report.media.reused > 0) {
			lines.push(`Images: ${report.media.uploaded} uploaded, ${report.media.reused} already in the library.`);
		}
		if (report.links.resolved > 0 || report.links.unresolved > 0) {
			lines.push(
				`Links between posts: ${report.links.resolved} turned into entry links, ${report.links.unresolved} left as written.`,
			);
		}
		if (report.mappingSaved) lines.push(`Mapping saved to ${report.mappingFile}; the next run will not ask.`);
		lines.push("");
	}
	for (const note of report.notes) lines.push(note);
	lines.push(report.summary);
	return lines.join("\n");
}
