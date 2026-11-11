import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { measure, settled } from "./measure";

type Composed = { run: () => Promise<void> };
/** `composeStories` of the package's Storybook (the packages have it; this folder does not). */
type Compose = (module: never) => Record<string, unknown>;

/**
 * One test for each story file: every story is drawn and brought to its state, and what is on the page is measured (`testing/measure.ts`). A story
 * whose `play` cannot reach its state here (a tooltip that needs a real hover) is measured as far as it got: bringing a story to its state is the
 * story's, and what a person does on a screen is a screen test's.
 */
export function measureStories(files: Record<string, unknown>, composeStories: Compose) {
	describe("every story, measured: control heights, pressable heights, corners and focus rings", () => {
		for (const [file, module] of Object.entries(files)) {
			it(file, async () => {
				const found: string[] = [];
				for (const [name, story] of Object.entries(composeStories(module as never)) as [string, Composed][]) {
					await story.run().catch(() => {});
					// A key, so that a focus from here on is the keyboard's and draws its ring.
					await userEvent.keyboard("{Shift}");
					await settled();
					for (const line of measure()) found.push(`${name} — ${line}`);
				}
				expect(found).toEqual([]);
				// A file of screen stories builds a site for each story: long, but one test, so a failure names the file.
			}, 600_000);
		}
	});
}
