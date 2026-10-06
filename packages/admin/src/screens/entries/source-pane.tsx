"use client";

import type { StoredDocument } from "@monti-cms/core/document";
import { EditorContent, useEditor } from "@tiptap/react";
import { X } from "lucide-react";
import { type Ref, useMemo, useState } from "react";
import { useCmsAdminComponents, useSourceFormat } from "../../admin-components";
import { documentKey } from "../../editor/document-key";
import { buildEditorExtensions } from "../../editor/extensions";
import { boxPreviewOf, storedToTiptap } from "../../editor/tiptap-content";
import { cn } from "../../lib/utils/cn";
import { IconButton } from "../../ui/icon-button";
import { t } from "./translate";

const PROSE =
	"prose cms-dark:prose-invert max-w-none text-base text-cms-foreground leading-relaxed focus:outline-none " +
	// Read-only: hide the code block tool row and keep collapsible boxes always open.
	"[&_[data-code-ui]]:hidden [&_[data-cms-collapsed]]:block " +
	// The source block matching the block under the cursor in the translation editor (source-sync).
	// Let only a faint background spread around the block, with no bar (a shadow spread, so it does not shift layout and also wraps list bullets).
	"[&_.cms-source-active]:rounded-sm [&_.cms-source-active]:bg-cms-primary/8 [&_.cms-source-active]:shadow-[0_0_0_12px_color-mix(in_oklab,var(--color-cms-primary)_8%,transparent)] [&_.cms-source-active]:transition-[background-color,box-shadow]";

function PreviewEditor({ doc, label }: { doc: StoredDocument; label: string }) {
	// Render text-decoration extensions (text color etc.) the same as in the editor.
	const { marks } = useCmsAdminComponents();
	const boxPreview = boxPreviewOf(useSourceFormat());
	const [extensions] = useState(() => buildEditorExtensions(marks));
	const editor = useEditor({
		immediatelyRender: false,
		editable: false,
		extensions,
		content: storedToTiptap(doc, { boxPreview }),
		editorProps: { attributes: { "aria-label": label, class: PROSE } },
	});
	return <EditorContent editor={editor} />;
}

/** Read-only preview of a document. Rendered the same as the post. Recreates the editor when the content changes. */
export function DocPreview({ doc, label = t("sourcePane.preview") }: { doc: StoredDocument; label?: string }) {
	const key = useMemo(() => documentKey(doc), [doc]);
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
	return (
		<aside
			ref={ref}
			aria-label={t("sourcePane.aria")}
			className={cn("flex h-full min-w-0 flex-col overflow-y-auto border-r bg-cms-background", className)}
		>
			<div
				data-source-header
				className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-cms-background/95 px-4 backdrop-blur"
			>
				<h2 className="flex-1 font-medium text-sm">{t("sourcePane.heading", { locale: locale.toUpperCase() })}</h2>
				<IconButton label={t("close")} side="bottom" onClick={onClose}>
					<X aria-hidden className="size-4" />
				</IconButton>
			</div>
			<h1
				className={cn(
					"px-6 pt-12 pb-5 font-semibold text-[34px] leading-tight tracking-tight",
					!title && "text-cms-muted-foreground/40",
				)}
			>
				{title || t("untitled")}
			</h1>
			<div className="px-6 pt-6 pb-[35vh]">
				<DocPreview doc={doc} label={t("sourcePane.body")} />
			</div>
		</aside>
	);
}
