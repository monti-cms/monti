"use client";

// The two side panels of the entry editor screen: the translation source pane (left) and the properties inspector (right).

import type { IncomingReferenceItem } from "@monti-cms/core/site";
import { useSite } from "@monti-cms/core/site";
import { cn } from "@monti-cms/ui";
import type { Ref } from "react";
import { PanelResizeHandle, type usePanelResize } from "../../ui/panel-resize";
import { SIDE_PANEL_WIDTH } from "../shared/side-panel";
import type { EntryEditor } from "./entry-editor-types";
import { InspectorPanel } from "./inspector-panel";
import { SourcePane } from "./source-pane";

type TranslationSource = NonNullable<EntryEditor["translation"]>["source"];

export function TranslationSourcePanel({
	source,
	paneRef,
	onClose,
}: {
	source: TranslationSource;
	paneRef: Ref<HTMLElement>;
	onClose: () => void;
}) {
	return (
		<div className="@5xl:static absolute inset-y-0 left-0 z-10 @5xl:w-[45%] w-[min(100%,28rem)] @5xl:shrink-0 @5xl:shadow-none shadow-monti-floating">
			<SourcePane ref={paneRef} doc={source.doc} title={source.title} locale={source.locale} onClose={onClose} />
		</div>
	);
}

interface InspectorSidePanelProps {
	editor: EntryEditor;
	resize: ReturnType<typeof usePanelResize>;
	incomingItems: IncomingReferenceItem[];
	isLoadingIncoming: boolean;
	onRefreshIncoming: (entryId: string) => void;
	onClose: () => void;
	focusPath: string | null;
	onFocused: () => void;
}

export function InspectorSidePanel({
	editor,
	resize,
	incomingItems,
	isLoadingIncoming,
	onRefreshIncoming,
	onClose,
	focusPath,
	onFocused,
}: InspectorSidePanelProps) {
	const site = useSite();
	const { entry, collection } = editor;
	return (
		// On narrow screens it overlays the body; on wide screens it sits beside it at the width the writer dragged it to.
		<div
			className={cn(
				"absolute @5xl:relative inset-y-0 right-0 @5xl:z-auto z-20 max-w-full @5xl:shrink-0 @5xl:shadow-none shadow-monti-floating",
				SIDE_PANEL_WIDTH,
			)}
			style={resize.style}
		>
			<PanelResizeHandle resize={resize} />
			{site.isCollection(collection) && (
				<InspectorPanel
					incomingReferences={incomingItems}
					isLoadingIncomingReferences={isLoadingIncoming}
					onRefreshIncomingReferences={() => {
						if (entry) onRefreshIncoming(entry.id);
					}}
					onSlugChange={editor.setSlug}
					onRegenerateSlug={editor.regenerateSlug}
					onClose={onClose}
					focusPath={focusPath}
					onFocused={onFocused}
				/>
			)}
		</div>
	);
}
