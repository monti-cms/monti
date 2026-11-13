import { HeadingIcon } from "@monti-cms/ui";
import {
	Code,
	Document,
	Image,
	ListBulleted,
	ListChecked,
	ListNumbered,
	Paragraph,
	Quotes,
	Subtract,
	Table,
	Template,
	TextFootnote,
} from "@monti-cms/ui/icons";
import type { ComponentType } from "react";

/**
 * The mark at the start of a block's row in the "/" menu and in "turn into" (editor-tools.md): a heading by its level (`HeadingIcon`), the others
 * by what they are. A site's own block brings its own (`Icon`), or has none and its name says it.
 */
export function BlockIcon({
	type,
	level,
	Own,
}: {
	type: string;
	level?: number;
	/** A site's block's own icon (`BlockDefinition.Icon`). */
	Own?: ComponentType<{ "aria-hidden"?: boolean }>;
}) {
	switch (type) {
		case "paragraph":
			return <Paragraph aria-hidden />;
		case "heading":
			return <HeadingIcon level={level ?? 2} />;
		case "bulletList":
			return <ListBulleted aria-hidden />;
		case "orderedList":
			return <ListNumbered aria-hidden />;
		case "checklist":
			return <ListChecked aria-hidden />;
		case "quote":
			return <Quotes aria-hidden />;
		case "codeBlock":
			return <Code aria-hidden />;
		case "divider":
			return <Subtract aria-hidden />;
		case "table":
			return <Table aria-hidden />;
		case "footnote":
			return <TextFootnote aria-hidden />;
		case "image":
			return <Image aria-hidden />;
		case "file":
			return <Document aria-hidden />;
		case "template":
			return <Template aria-hidden />;
	}
	return Own ? <Own aria-hidden /> : null;
}
