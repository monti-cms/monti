import type { DocumentComponentsContext, LooseDocumentComponents, MarkBlockProps } from "@monti-cms/core/render";
import type { tooltipBlock } from "./definition";
import { Tooltip } from "./render.client";

export { Tooltip };

/**
 * Public components for the tooltip in the JSON renderer (`renderDocument`): the mark `tooltip`, and the code tag `Tooltip` that draws a tooltip inside a
 * code block (a text effect). Both show the same component.
 */
export const documentComponents = (_context: DocumentComponentsContext): LooseDocumentComponents => ({
	marks: {
		tooltip: ({ content, children }: MarkBlockProps<typeof tooltipBlock>) => (
			<Tooltip content={content}>{children}</Tooltip>
		),
	},
	codeTags: { Tooltip },
});
