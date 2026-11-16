import { readMarkdown } from "@monti-cms/mdx/read";
import { ChatMessage } from "@monti-cms/ui";
import { useMemo } from "react";
import { ReadBody } from "../editor/read-body";

/**
 * An answer's text as the panel draws it: its Markdown read into a body by the MDX plugin's reader and drawn by `ReadBody` as the editor draws a body
 * (bold, links, code, lists, headings, fenced code in its frame). The model's text never makes the browser ask for anything: a picture is a box with
 * its name, never loaded; a link to a place in the admin (`#/…`) opens it here, a link elsewhere opens a new tab only when pressed and sends no
 * referrer, and anything else that looks like a link (`javascript:`, `data:`) stays words. While the answer is arriving the caret stands after its
 * last words (`streaming`); an answer with no words yet is the caret alone.
 */
export function Prose({
	text,
	streaming = false,
	onOpen,
}: {
	text: string;
	streaming?: boolean;
	/** Opens a place of the admin a link in the text names (`#/…`). */
	onOpen: (address: string) => void;
}) {
	const doc = useMemo(() => readMarkdown(text).doc, [text]);
	if (doc.blocks.length === 0) return streaming ? <ChatMessage author="assistant" streaming /> : null;
	return (
		<ChatMessage author="assistant" streaming={streaming}>
			<ReadBody doc={doc} size="chat" onOpen={onOpen} />
		</ChatMessage>
	);
}
