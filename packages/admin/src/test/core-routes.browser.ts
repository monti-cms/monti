import { afterEach } from "vitest";
import { commands } from "vitest/browser";

declare module "vitest/browser" {
	interface BrowserCommands {
		/** `coreRouteProblem` of `core-routes.ts` for each route, run in Node (`vitest.browser.config.ts`). */
		coreRouteProblems: (routes: readonly string[]) => Promise<string[]>;
	}
}

/**
 * The browser tests' `assertCoreServes`: the core router brings the whole server, which cannot load in a browser, so the routes a test gives the fake API
 * are checked in Node once the test is over, and a route the core API does not serve fails that test.
 */
const given: string[] = [];

export const assertCoreServes = (route: string) => {
	given.push(route);
};

afterEach(async () => {
	const problems = await commands.coreRouteProblems(given.splice(0));
	if (problems.length > 0) throw new Error(problems.join("\n"));
});
