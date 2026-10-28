"use client";

// The two side panels of the entry editor screen: the translation source pane (left) and the properties inspector (right).

import type { IncomingReferenceItem } from "@monti-cms/core/site";
import { useSite } from "@monti-cms/core/site";
import type { Ref } from "react";
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
		<div className="@min-[784px]:static absolute inset-y-0 left-0 z-10 @min-[784px]:w-[45%] w-[min(100%,28rem)] @min-[784px]:shrink-0 @min-[784px]:shadow-none shadow-monti-floating">
			<SourcePane ref={paneRef} doc={source.doc} title={source.title} locale={source.locale} onClose={onClose} />
		</div>
	);
}

interface InspectorSidePanelProps {
	editor: EntryEditor;
	incomingItems: IncomingReferenceItem[];
	isLoadingIncoming: boolean;
	onRefreshIncoming: (entryId: string) => void;
	focusPath: string | null;
	onFocused: () => void;
}

export function InspectorSidePanel({
	editor,
	incomingItems,
	isLoadingIncoming,
	onRefreshIncoming,
	focusPath,
	onFocused,
}: InspectorSidePanelProps) {
	const site = useSite();
	const { entry, collection } = editor;
	return (
		// On narrow screens it overlays the body; on wide screens it sits beside it, at the design's width for the properties panel.
		<div className="absolute @min-[784px]:relative inset-y-0 right-0 @min-[784px]:z-auto z-20 w-full max-w-full @min-[784px]:shrink-0 @min-[784px]:shadow-none shadow-monti-floating sm:w-monti-panel">
			{site.isCollection(collection) && (
				<InspectorPanel
					incomingReferences={incomingItems}
					isLoadingIncomingReferences={isLoadingIncoming}
					onRefreshIncomingReferences={() => {
						if (entry) onRefreshIncoming(entry.id);
					}}
					onSlugChange={editor.setSlug}
					onRegenerateSlug={editor.regenerateSlug}
					focusPath={focusPath}
					onFocused={onFocused}
				/>
			)}
		</div>
	);
}
