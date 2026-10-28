"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { SearchToggle } from "@monti-cms/ui";
import { type ListState, searchPatch } from "./list-state";
import { screensMessages } from "./messages";
import { useDebouncedInput } from "./shared/use-debounced";

/**
 * The header's "Search" button, which opens the search box in its place (the board's search). Sends a server search when typing pauses. Document collections get a small toggle inside the box
 * that widens the search to the body.
 */
export function ListSearch({
	state,
	onChange,
	allowBody = true,
}: {
	state: ListState;
	onChange: (patch: Partial<ListState>) => void;
	allowBody?: boolean;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const [search, setSearch] = useDebouncedInput(state.search, (text) => onChange(searchPatch(text)));

	const withBody = site.isDocumentCollection(state.collection) && allowBody;
	return (
		<SearchToggle
			label={t("toolbar.search")}
			aria-label={t("toolbar.searchLabel")}
			value={search}
			onValueChange={setSearch}
			placeholder={state.includeBody ? t("toolbar.searchBodyPlaceholder") : t("toolbar.searchPlaceholder")}
			targets={
				withBody
					? [
							{ value: "fields", label: t("toolbar.targetFields") },
							{ value: "all", label: t("toolbar.targetAll") },
						]
					: undefined
			}
			target={state.includeBody ? "all" : "fields"}
			onTargetChange={(target) => onChange({ includeBody: target === "all" })}
			targetLabel={t("toolbar.target")}
		/>
	);
}
