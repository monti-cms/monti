"use client";

import type { StoredDocument } from "@monti-cms/core/document";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { EditorContent, useEditor } from "@tiptap/react";
import { X } from "lucide-react";
import { type Ref, useMemo, useState } from "react";
import { useAdminComponents, useSourceFormat } from "../../admin-components";
import { documentKey } from "../../editor/document-key";
import { buildEditorExtensions } from "../../editor/extensions";
import { boxPreviewOf, storedToTiptap } from "../../editor/tiptap-content";
import { commonMessages } from "../../lib/common.messages";
import { cn } from "../../lib/utils/cn";
import { IconButton } from "../../ui/icon-button";
import { entriesMessages } from "./messages";
import { ACTIVE_BLOCK_STYLE } from "./source-sync";

const PROSE =
	"prose monti-dark:prose-invert max-w-none text-base text-monti-foreground leading-relaxed focus:outline-none " +
	// Read-only: hide the code block tool row. A collapsible box is open unless the translation box it is paired with is collapsed (source-sync).
	`[&_[data-code-ui]]:hidden [&_[data-monti-collapsed]]:block [&_[data-source-collapsed]]:hidden! ${ACTIVE_BLOCK_STYLE}`;

function PreviewEditor({ doc, label }: { doc: StoredDocument; label: string }) {
	const site = useSite();
	// Render text-decoration extensions (text color etc.) the same as in the editor.
	const { marks } = useAdminComponents();
	const boxPreview = boxPreviewOf(useSourceFormat());
	const [extensions] = useState(() => buildEditorExtensions(site, marks));
	const editor = useEditor({
		immediatelyRender: false,
		editable: false,
		extensions,
		content: storedToTiptap(site, doc, { boxPreview }),
		editorProps: { attributes: { "aria-label": label, class: PROSE } },
	});
	return <EditorContent editor={editor} />;
}

/** Read-only preview of a document. Rendered the same as the post. Recreates the editor when the content changes. */
export function DocPreview({ doc, label: labelProp }: { doc: StoredDocument; label?: string }) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const label = labelProp ?? t("sourcePane.preview");
	const key = useMemo(() => documentKey(site, doc), [doc, site]);
	return <PreviewEditor key={key} doc={doc} label={label} />;
}

/** The full source placed beside the translation. Scrolls separately from the translation editor. */
export function SourcePane({
	doc,
	locale,
	title,
	onClose,
	className,
	ref,
}: {
	doc: StoredDocument;
	locale: string;
	/** Source title. Shown large above the body, matching the title slot of the translation editor. */
	title: string;
	onClose: () => void;
	className?: string;
	/** The scrolling element. Used to link scrolling with the editor. */
	ref?: Ref<HTMLElement>;
}) {
	const t = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	return (
		<aside
			ref={ref}
			aria-label={t("sourcePane.aria")}
			className={cn("flex h-full min-w-0 flex-col overflow-y-auto border-r bg-monti-background", className)}
		>
			<div
				data-source-header
				className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-monti-background/95 px-4 backdrop-blur"
			>
				<h2 className="flex-1 font-medium text-sm">{t("sourcePane.heading", { locale: locale.toUpperCase() })}</h2>
				<IconButton label={tc("close")} side="bottom" onClick={onClose}>
					<X aria-hidden className="size-4" />
				</IconButton>
			</div>
			<h1
				className={cn(
					"monti-content-font px-6 pt-12 pb-5 font-semibold text-monti-display leading-tight tracking-tight",
					!title && "text-monti-muted-foreground/40",
				)}
			>
				{title || tc("untitled")}
			</h1>
			<div className="monti-content-font px-6 pt-6 pb-[35vh]">
				<DocPreview doc={doc} label={t("sourcePane.body")} />
			</div>
		</aside>
	);
}
