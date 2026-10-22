"use client";

import { useTranslator } from "@monti-cms/core/site";
import { UiLabelsProvider } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { commonMessages } from "../lib/common.messages";
import { uiMessages } from "./messages";

/** Gives the design system's components their few built-in words (close, clear, pagination...) in the admin's language. */
export function AdminUiLabels({ children }: { children: ReactNode }) {
	const t = useTranslator(uiMessages);
	const tc = useTranslator(commonMessages);
	return (
		<UiLabelsProvider
			labels={{
				close: tc("close"),
				cancel: tc("cancel"),
				save: tc("save"),
				saving: tc("saving"),
				clear: t("clear"),
				deselect: t("deselect"),
				paginationLabel: t("pagination.label"),
				paginationPrevious: t("pagination.previous"),
				paginationPreviousPage: t("pagination.previousPage"),
				paginationNext: t("pagination.next"),
				paginationNextPage: t("pagination.nextPage"),
				paginationMore: t("pagination.more"),
				sidebarTitle: t("sidebar.title"),
				sidebarDescription: t("sidebar.description"),
				sidebarToggle: t("sidebar.toggle"),
			}}
		>
			{children}
		</UiLabelsProvider>
	);
}
