import { describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../test/site";
import type { DatabaseAdapter, MigrationSummary, UnreadableBody } from "../../server/define";
import { createCms } from "../create-cms";
import { describeUnreadable, mergeUnreadable } from "../migration-report";

/** What `monti migrate` says about bodies that could not be read: a short plain summary by default, every body with `verbose`. */

const ACORN = "Could not parse expression with acorn";
const body = (id: number, over: Partial<UnreadableBody> = {}): UnreadableBody => ({
	where: `entry_bodies 00000000-0000-0000-0000-${String(id).padStart(12, "0")}/${over.kind === "published" ? "published" : "working"}`,
	kind: "draft",
	reason: "unparsed",
	detail: ACORN,
	hasDirective: false,
	...over,
});

/** A database that finds `found` unreadable bodies while it migrates, and says what `detail` lines the steps had for each. */
function databaseFinding(found: readonly UnreadableBody[], summary: MigrationSummary = { applied: 3, upToDate: 21 }) {
	return {
		name: "fake",
		createStore: vi.fn(),
		migrate: vi.fn(async (options: Parameters<DatabaseAdapter["migrate"]>[0]) => {
			for (const item of found) {
				options.detail?.(
					`[monti] soft line endings left as they are in ${item.where}: ${item.reason} (${item.detail})`,
				);
				options.onUnreadableBody?.(item);
			}
			return summary;
		}),
		pluginStorage: vi.fn(),
		close: vi.fn(async () => undefined),
	} as unknown as DatabaseAdapter & { migrate: ReturnType<typeof vi.fn> };
}

async function migrateWith(
	database: DatabaseAdapter,
	options: {
		verbose?: boolean;
		reconvertBodies?: boolean;
		saveDetail?: (lines: readonly string[]) => string | undefined;
	} = {},
) {
	const lines: string[] = [];
	const cms = createCms({
		config: testConfig,
		server: {
			database,
			auth: { name: "x", create: () => ({}) as never },
			secret: "s",
		},
	});
	await cms.migrate({ log: (line) => lines.push(line), ...options });
	return lines;
}

const published = (id: number) => body(id, { kind: "published", hasDirective: true });
const drafts = (from: number, count: number) => Array.from({ length: count }, (_, index) => body(from + index));

describe("monti migrate: bodies that could not be read", () => {
	it("says in a few plain lines how many, which kind, and that nothing is lost; no line per body", async () => {
		const found = [...Array.from({ length: 12 }, (_, i) => published(i)), ...drafts(100, 27)];
		const lines = await migrateWith(databaseFinding(found));
		const text = lines.join("\n");
		expect(text).toContain(
			"39 bodies (12 published, 27 drafts) could not be read and were kept exactly as they were (nothing is lost).",
		);
		expect(text).toContain("Most common reason: a `{...}` was read as code but is not valid code (39 of 39).");
		// None of the per-body lines, ids or the reader's own wording.
		expect(text).not.toMatch(/entry_bodies|00000000-0000|acorn|soft line endings/);
		expect(lines.length).toBeLessThan(12);
		expect(text).toContain("Applied 3 steps, 21 already up to date.");
	});

	it("suggests the directive syntax and the way to read the bodies again only when a failing body has ::: blocks", async () => {
		const withBlocks = (await migrateWith(databaseFinding([published(1), body(2)]))).join("\n");
		expect(withBlocks).toContain("::: blocks (callout, tabs, ...)");
		expect(withBlocks).toContain("mdx({ syntax: [directiveSyntax()] })");
		expect(withBlocks).toContain("@monti-cms/syntax-directive");
		expect(withBlocks).toContain("monti migrate --reconvert-bodies");

		const without = (await migrateWith(databaseFinding(drafts(1, 3)))).join("\n");
		expect(without).not.toMatch(/:::|directiveSyntax|syntax-directive/);
		expect(without).toContain("monti migrate --reconvert-bodies");
	});

	it("--verbose keeps the per-body detail the steps report, and lists every body", async () => {
		const found = [published(1), ...drafts(2, 2)];
		const lines = await migrateWith(databaseFinding(found), { verbose: true });
		const text = lines.join("\n");
		for (const item of found) expect(text).toContain(item.where);
		expect(text).toContain("soft line endings left as they are in entry_bodies");
		expect(text).toContain("(draft): a `{...}` was read as code");
		expect(text).toContain("3 bodies (1 published, 2 drafts) could not be read");
	});

	it("saves the full detail to a file and ends the summary with its path; nothing is saved when there is nothing to report", async () => {
		const saved: (readonly string[])[] = [];
		const saveDetail = (lines: readonly string[]) => {
			saved.push(lines);
			return ".monti/logs/migrate-2026-10-13T14-05-12.log";
		};
		const found = [published(1), ...drafts(2, 2)];
		const lines = await migrateWith(databaseFinding(found), { saveDetail });
		expect(lines.at(-1)).toBe("Full details: .monti/logs/migrate-2026-10-13T14-05-12.log");
		// The file has a row for every body and the steps' own lines; the screen does not.
		expect(saved).toHaveLength(1);
		for (const item of found) expect(saved[0]?.join("\n")).toContain(item.where);
		expect(saved[0]?.join("\n")).toContain("soft line endings left as they are");
		expect(lines.join("\n")).not.toContain("soft line endings");

		const clean = await migrateWith(databaseFinding([]), { saveDetail });
		expect(saved).toHaveLength(1);
		expect(clean.join("\n")).not.toContain("Full details");
	});

	it("says nothing about bodies when none was kept", async () => {
		const text = (await migrateWith(databaseFinding([]))).join("\n");
		expect(text).not.toMatch(/could not be read|kept exactly/);
	});

	it("the same body reported by several steps is counted once, keeping the reason any of them gave", async () => {
		const item = body(1);
		const lines = await migrateWith(
			databaseFinding([
				item,
				{ where: item.where, kind: "draft", hasDirective: true },
				{ where: item.where, kind: "draft", hasDirective: false },
			]),
		);
		const text = lines.join("\n");
		expect(text).toContain("1 body (1 draft) could not be read and was kept exactly as it was");
		expect(text).toContain("Most common reason: a `{...}` was read as code");
		expect(text).toContain("::: blocks");
		const merged = mergeUnreadable(new Map([[item.where, item]]), {
			where: item.where,
			kind: "draft",
			hasDirective: false,
		});
		expect(merged.reason).toBe("unparsed");
	});

	it("--reconvert-bodies asks the database to read them again and reports how it went, without the advice to do it", async () => {
		const database = databaseFinding(drafts(1, 2), {
			applied: 0,
			upToDate: 24,
			reconverted: { converted: 37, remaining: 2 },
		});
		const lines = await migrateWith(database, { reconvertBodies: true });
		expect(database.migrate.mock.calls[0]?.[0].reconvertBodies).toBe(true);
		const text = lines.join("\n");
		expect(text).toContain("Read the unreadable bodies again: 37 can be read now, 2 still cannot.");
		expect(text).toContain("2 bodies (2 drafts) could not be read");
		expect(text).not.toContain("--reconvert-bodies");
		expect(text).not.toMatch(/directiveSyntax/);
	});

	it("does not ask to read them again unless told to", async () => {
		const database = databaseFinding([]);
		await migrateWith(database);
		expect(database.migrate.mock.calls[0]?.[0].reconvertBodies).toBe(false);
	});
});

describe("describeUnreadable", () => {
	it("names other reasons in the reader's own words and counts the most common", () => {
		const lines = describeUnreadable([
			body(1, { reason: "front matter", detail: undefined }),
			body(2, { reason: "front matter", detail: undefined }),
			body(3, { reason: "something odd", detail: undefined }),
		]);
		expect(lines.join("\n")).toContain("Most common reason: the body starts with front matter (a --- block) (2 of 3).");
	});
});
