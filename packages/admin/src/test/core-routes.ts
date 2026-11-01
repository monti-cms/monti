// From its own module, not the `@monti-cms/core/testing` barrel: the barrel also brings the Postgres store and the test server.
import { matchRoute } from "../../../core/src/http/router";

/**
 * What is wrong with a route of the fake API (`"METHOD /v1/path/:param"`), or `undefined` when the core API serves it with that method. The screen and
 * the fake both name routes as text, so without this a route renamed or removed in core would still pass every screen test and break only the real app.
 */
export const coreRouteProblem = (route: string): string | undefined => {
	const [method = "", path = ""] = route.split(" ");
	const segments = path.split("/").filter(Boolean);
	const core = matchRoute(segments.map((segment) => (segment.startsWith(":") ? "x" : segment)));
	if (!core) return `fake API: the core API has no route ${route}`;
	if (!(method in core.module)) return `fake API: the core API answers no ${route}`;
	return undefined;
};

/** Refuses a route the core API does not serve with that method. The browser tests check it after the test instead (`core-routes.browser.ts`). */
export const assertCoreServes = (route: string) => {
	const problem = coreRouteProblem(route);
	if (problem) throw new Error(problem);
};
