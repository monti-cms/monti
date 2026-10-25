"use client";

import { createContext, type ReactNode, useContext } from "react";

/**
 * The few words the components write themselves: screen reader names and default button labels. English by default; an app passes its own
 * language through `UiLabelsProvider` (the admin does, from its message dictionaries), so the design system never depends on a translation library.
 */
export interface UiLabels {
	close: string;
	cancel: string;
	save: string;
	saving: string;
	loading: string;
	clear: string;
	deselect: string;
	paginationLabel: string;
	paginationPrevious: string;
	paginationPreviousPage: string;
	paginationNext: string;
	paginationNextPage: string;
	paginationMore: string;
	sidebarTitle: string;
	sidebarDescription: string;
	sidebarToggle: string;
	sidebarResize: string;
	resize: string;
}

export const DEFAULT_UI_LABELS: UiLabels = {
	close: "Close",
	cancel: "Cancel",
	save: "Save",
	saving: "Saving…",
	loading: "Loading",
	clear: "Clear",
	deselect: "Remove",
	paginationLabel: "Pagination",
	paginationPrevious: "Previous",
	paginationPreviousPage: "Previous page",
	paginationNext: "Next",
	paginationNextPage: "Next page",
	paginationMore: "More pages",
	sidebarTitle: "Sidebar",
	sidebarDescription: "Shows the mobile sidebar.",
	sidebarToggle: "Toggle sidebar",
	sidebarResize: "Resize sidebar",
	resize: "Resize",
};

const LabelsContext = createContext<UiLabels>(DEFAULT_UI_LABELS);

export function UiLabelsProvider({ labels, children }: { labels: Partial<UiLabels>; children: ReactNode }) {
	return <LabelsContext.Provider value={{ ...DEFAULT_UI_LABELS, ...labels }}>{children}</LabelsContext.Provider>;
}

export const useUiLabels = (): UiLabels => useContext(LabelsContext);
