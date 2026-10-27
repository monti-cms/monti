"use client";

import type { StoredDocument } from "@monti-cms/core/document";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Heading, IconButton, Inline, Stack } from "@monti-cms/ui";
import { EditorContent, useEditor } from "@tiptap/react";
import { X } from "lucide-react";
import { type Ref, useMemo, useState } from "react";
import { useAdminComponents, useSourceFormat } from "../../admin-components";
import { documentKey } from "../../editor/document-key";
import { buildEditorExtensions } from "../../editor/extensions";
import { boxPreviewOf, storedToTiptap } from "../../editor/tiptap-content";
import { commonMessages } from "../../lib/common.messages";
import { entriesMessages } from "./messages";
import { ScrollRoom } from "./scroll-room";
import { ACTIVE_BLOCK_STYLE } from "./source-sync";

const PROSE =
	"prose monti-dark:prose-invert max-w-none text-monti-reading text-monti-default focus:outline-none" +
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
	ref,
}: {
	doc: StoredDocument;
	locale: string;
	/** Source title. Shown large above the body, matching the title slot of the translation editor. */
	title: string;
	onClose: () => void;
	/** The scrolling element. Used to link scrolling with the editor. */
	ref?: Ref<HTMLElement>;
}) {
	const t = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	return (
		<Stack
			as="aside"
			ref={ref}
			aria-label={t("sourcePane.aria")}
			gap={0}
			height="full"
			minWidth={0}
			overflow="y"
			border="right"
			background="page"
		>
			<Inline
				data-source-header
				position="sticky"
				justify="between"
				gap={8}
				height="icon-button"
				shrink={false}
				background="page"
				border="bottom"
				paddingX={16}
			>
				<Heading as="h2" variant="label">
					{t("sourcePane.heading", { locale: locale.toUpperCase() })}
				</Heading>
				<IconButton label={tc("close")} side="bottom" onClick={onClose}>
					<X aria-hidden />
				</IconButton>
			</Inline>
			<Box paddingX={24} paddingTop={48} paddingBottom={16}>
				<Heading as="h1" variant="display" tone={title ? undefined : "subtle"}>
					{title || tc("untitled")}
				</Heading>
			</Box>
			<Box paddingX={24} paddingTop={24}>
				<ScrollRoom>
					<DocPreview doc={doc} label={t("sourcePane.body")} />
				</ScrollRoom>
			</Box>
		</Stack>
	);
}
