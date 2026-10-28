import { HOST_PATTERN, isHomeLink, PREVIEW_PARAM_NAME } from "@monti-cms/core/site";
import type { DraftProblem } from "./draft-problems";
import { type Obj, sectionOf } from "./schema-model";

/** The problems of the site settings of the draft: the home link, each host name and the preview language query. A value that is not written (empty) is no problem. */
export function siteProblems(file: Obj): DraftProblem[] {
	const site = sectionOf(file, "site");
	const problems: DraftProblem[] = [];
	if (typeof site.homeLink === "string" && !isHomeLink(site.homeLink)) {
		problems.push({ area: "site", path: "site.homeLink", code: "home-link" });
	}
	const aliases = Array.isArray(site.aliases) ? site.aliases : [];
	for (const [index, alias] of aliases.entries()) {
		if (typeof alias === "string" && !HOST_PATTERN.test(alias)) {
			problems.push({ area: "site", path: `site.aliases.${index}`, code: "host" });
		}
	}
	const param = site.previewLocaleParam;
	if (typeof param === "string" && !PREVIEW_PARAM_NAME.test(param)) {
		problems.push({ area: "site", path: "site.previewLocaleParam", code: "query-name" });
	}
	return problems;
}

/** The problem at `path` (like `site.homeLink`), if the draft has one. */
export const problemAt = (problems: readonly DraftProblem[], path: string): DraftProblem | undefined =>
	problems.find((problem) => problem.path === path);
