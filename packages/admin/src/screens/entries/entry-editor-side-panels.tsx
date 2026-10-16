"use client";

// The two side panels of the entry editor screen: the translation source pane (left) and the properties inspector (right).

import type { IncomingReferenceItem } from "@monti-cms/core/site";
import { useSite } from "@monti-cms/core/site";
import type { Ref } from "react";
import { cn } from "../../lib/utils/cn";
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
		<SourcePane
			ref={paneRef}
			doc={source.doc}
			title={source.title}
			locale={source.locale}
			onClose={onClose}
			className="absolute inset-y-0 left-0 z-10 w-[min(100%,28rem)] shadow-cms-pop lg:static lg:w-[45%] lg:shrink-0 lg:shadow-none"
		/>
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
				"absolute inset-y-0 right-0 z-20 max-w-full shadow-cms-pop lg:relative lg:z-auto lg:shrink-0 lg:shadow-none",
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
