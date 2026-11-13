import type { Doc } from "@monti-cms/core";
import {
	Box,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	Inline,
	MenuValue,
	ResizablePane,
	Text,
} from "@monti-cms/ui";
import { DocumentView, FitToWidth } from "@monti-cms/ui/icons";
import { useState } from "react";
import { useAdmin } from "../../operations/admin-context";

/** How wide the writing column is: the reading width, or as wide as the screen gives. */
export type BodyWidth = "reading" | "full";

const KEY = "monti.editor.width";

const stored = (): BodyWidth => {
	try {
		return localStorage.getItem(KEY) === "full" ? "full" : "reading";
	} catch {
		return "reading";
	}
};

/**
 * The document tools of an editor's ⋯ (editor-tools.md, doc 14): the body's width, kept in this browser as the screen mode is, and the view
 * of the document a plugin brings that is switched on (one at a time; it is not kept: a view is opened to look at something).
 */
export function useDocumentTools() {
	const [width, setWidthState] = useState<BodyWidth>(stored);
	const [view, setView] = useState<string | null>(null);
	const setWidth = (next: BodyWidth) => {
		setWidthState(next);
		try {
			localStorage.setItem(KEY, next);
		} catch {}
	};
	return { width, setWidth, view, setView };
}

type Tools = ReturnType<typeof useDocumentTools>;

/** The group's rows in the ⋯ menu, with the line that ends it: the plugins' views as switches, then the body's width. */
export function DocumentToolRows({ tools, onView }: { tools: Tools; onView?: (view: string | null) => void }) {
	const { t, language, documentViews } = useAdmin();
	const widths: { value: BodyWidth; label: string }[] = [
		{ value: "reading", label: t("entry.width.reading") },
		{ value: "full", label: t("entry.width.full") },
	];
	return (
		<>
			{documentViews.map((each) => (
				<DropdownMenuCheckboxItem
					key={each.key}
					checked={tools.view === each.key}
					onCheckedChange={(checked) => {
						const next = checked ? each.key : null;
						tools.setView(next);
						onView?.(next);
					}}
				>
					<DocumentView aria-hidden />
					{each.label[language]}
				</DropdownMenuCheckboxItem>
			))}
			<DropdownMenuSub>
				<DropdownMenuSubTrigger>
					<FitToWidth aria-hidden />
					{t("entry.width")}
					<MenuValue>{widths.find((each) => each.value === tools.width)?.label}</MenuValue>
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent>
					<DropdownMenuRadioGroup value={tools.width} onValueChange={(next) => tools.setWidth(next as BodyWidth)}>
						{widths.map((each) => (
							<DropdownMenuRadioItem key={each.value} value={each.value}>
								{each.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuSubContent>
			</DropdownMenuSub>
			<DropdownMenuSeparator />
		</>
	);
}

/** The view that is switched on, beside the body: the plugin draws what it shows of the document as it is typed. */
export function DocumentViewPane({ tools, doc, title }: { tools: Tools; doc: Doc; title: string }) {
	const { language, documentViews, t } = useAdmin();
	const shown = documentViews.find((each) => each.key === tools.view);
	if (!shown) return null;
	const name = shown.label[language];
	return (
		<ResizablePane
			resizeKey="monti.editor.view"
			defaultWidth={480}
			min={320}
			max={840}
			edge="start"
			label={t("entry.viewWidth", { name })}
		>
			<Box as="aside" aria-label={name} background="tool" grow overflow="y">
				<Box paddingX={24} paddingTop={16} paddingBottom={48}>
					<Inline minHeight="control-md">
						<Text variant="meta" tone="subtle">
							{name}
						</Text>
					</Inline>
					<shown.View doc={doc} title={title} />
				</Box>
			</Box>
		</ResizablePane>
	);
}
