import { HeadingIcon } from "@monti-cms/ui";
import {
	Code,
	ListBulleted,
	ListChecked,
	ListNumbered,
	Paragraph,
	Quotes,
	Subtract,
	Template,
} from "@monti-cms/ui/icons";

/**
 * The mark at the start of a block's row in the "/" menu and in "turn into" (editor-tools.md): a heading by its level (`HeadingIcon`), the others
 * by what they are. A site's own block has none; its name says it.
 */
export function BlockIcon({ type, level }: { type: string; level?: number }) {
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
		case "template":
			return <Template aria-hidden />;
	}
	return null;
}
