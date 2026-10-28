"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, SearchBox } from "@monti-cms/ui";
import type { ListState } from "./list-state";
import { screensMessages } from "./messages";
import { useDebouncedInput } from "./shared/use-debounced";

/**
 * Search box in the header. Sends a server search when typing pauses. Document collections get a small toggle inside the box
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
	const [search, setSearch] = useDebouncedInput(state.search, (text) => onChange({ search: text }));

	const withBody = site.isDocumentCollection(state.collection) && allowBody;
	return (
		<Box width="panel">
			<SearchBox
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
		</Box>
	);
}
