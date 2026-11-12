import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { coreMessages } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { assistantMessages } from "./messages";

/** Every source file under a folder that is not a test. */
function sources(folder: string): string[] {
	return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? sources(join(folder, entry.name))
			: /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
				? [join(folder, entry.name)]
				: [],
	);
}

/** The reasons the assistant's and the proposals' code refuses with: each is shown to a person as it is (a toast, a note on a card). */
function refusals(): string[] {
	const here = import.meta.dirname;
	const keys = new Set<string>();
	for (const file of [...sources(here), ...sources(join(here, "../../core/src"))])
		for (const found of readFileSync(file, "utf8").matchAll(
			/(?:CheckError|ForbiddenError)\(\{\s*key:\s*"((?:assistant|conversations|proposals)\.[A-Za-z.]+)"/g,
		))
			keys.add(found[1]);
	return [...keys].sort();
}

describe("the words of a refusal", () => {
	it("10-1 every reason the assistant, a conversation or a proposal refuses with is written in Korean and in English", () => {
		const keys = refusals();
		// The search finds them: a change to how refusals are thrown must not leave this test looking at nothing.
		expect(keys).toContain("assistant.busy");
		expect(keys).toContain("proposals.notWaiting");
		const written = (locale: "ko" | "en") => ({
			...(coreMessages.messages[locale] as Record<string, string>),
			...(assistantMessages.messages[locale] as Record<string, string>),
		});
		for (const locale of ["ko", "en"] as const)
			expect(
				keys.filter((key) => !written(locale)[key]),
				`without ${locale}`,
			).toEqual([]);
	});
});
