import { ChatMessage, CodeBlock, Inline, Stack, Text, TextButton } from "@monti-cms/ui";
import type { ReactNode } from "react";

/** A piece of an answer's text: a paragraph, a list, or code shown as it is. */
export type ProseBlock =
	| { kind: "text"; text: string; strong?: boolean }
	| { kind: "list"; ordered: boolean; items: string[] }
	| { kind: "code"; text: string };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;

/** The model's text in pieces. Only what the panel draws is read: paragraphs, lists, headings (as a bold line) and fenced code. */
export function proseBlocks(text: string): ProseBlock[] {
	const blocks: ProseBlock[] = [];
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	let paragraph: string[] = [];
	const flush = () => {
		if (paragraph.length > 0) blocks.push({ kind: "text", text: paragraph.join("\n") });
		paragraph = [];
	};
	for (let at = 0; at < lines.length; at += 1) {
		const line = lines[at] ?? "";
		if (line.trimStart().startsWith("```")) {
			flush();
			const code: string[] = [];
			at += 1;
			// A fence still open (the answer is arriving) holds everything after it.
			while (at < lines.length && !(lines[at] ?? "").trimStart().startsWith("```")) {
				code.push(lines[at] ?? "");
				at += 1;
			}
			blocks.push({ kind: "code", text: code.join("\n") });
			continue;
		}
		if (line.trim() === "") {
			flush();
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading) {
			flush();
			blocks.push({ kind: "text", text: heading[1] ?? "", strong: true });
			continue;
		}
		const item = BULLET.exec(line) ?? NUMBER.exec(line);
		if (item) {
			flush();
			const ordered = NUMBER.test(line);
			const last = blocks.at(-1);
			if (last?.kind === "list" && last.ordered === ordered) last.items.push(item[1] ?? "");
			else blocks.push({ kind: "list", ordered, items: [item[1] ?? ""] });
			continue;
		}
		paragraph.push(line);
	}
	flush();
	return blocks;
}

// A picture, a link, bold, code, emphasis: in this order, so a picture is not read as a link with a mark before it.
const INLINE = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\s][^*]*)\*/g;

/**
 * The words of one line. The model's text never makes the browser ask for anything: a picture is its words and its address as text, never
 * loaded; a link to a place in the admin (`#/…`) opens it here; a link elsewhere opens a new tab only when pressed, and sends no referrer.
 * Anything else that looks like a link (`javascript:`, `data:`) stays text.
 */
function inline(text: string, onOpen: (address: string) => void): ReactNode[] {
	const nodes: ReactNode[] = [];
	let from = 0;
	for (const match of text.matchAll(INLINE)) {
		const at = match.index ?? 0;
		if (at > from) nodes.push(text.slice(from, at));
		const [whole, alt, picture, label, address, strong, code, emphasis] = match;
		const key = `${at}:${whole.length}`;
		if (picture !== undefined) nodes.push(alt ? `${alt} (${picture})` : picture);
		else if (address !== undefined && label !== undefined) {
			if (address.startsWith("#/"))
				nodes.push(
					<TextButton key={key} variant="underline" onClick={() => onOpen(address)}>
						{label}
					</TextButton>,
				);
			else if (/^https?:\/\//i.test(address))
				nodes.push(
					<TextButton
						key={key}
						variant="underline"
						href={address}
						target="_blank"
						// `noreferrer`: the page it opens is not told where the person came from.
						rel="noopener noreferrer"
						title={address}
					>
						{label}
					</TextButton>,
				);
			else nodes.push(whole);
		} else if (strong !== undefined)
			nodes.push(
				<Text key={key} weight="semibold" tone="inherit">
					{strong}
				</Text>,
			);
		else if (code !== undefined)
			nodes.push(
				<Text key={key} mono variant="meta" tone="inherit">
					{code}
				</Text>,
			);
		else if (emphasis !== undefined)
			nodes.push(
				<Text key={key} italic tone="inherit">
					{emphasis}
				</Text>,
			);
		from = at + whole.length;
	}
	if (from < text.length) nodes.push(text.slice(from));
	return nodes;
}

/**
 * An answer's text as the panel draws it: its paragraphs each a `ChatMessage`, lists with their marks, code as it is. While the answer is
 * arriving the caret stands after its last words (`streaming`); an answer with no words yet is the caret alone.
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
	const blocks = proseBlocks(text);
	if (blocks.length === 0) return streaming ? <ChatMessage author="assistant" streaming /> : null;
	return (
		<>
			{blocks.map((block, index) => {
				const last = index === blocks.length - 1;
				// A block's place in the answer names it: an answer only grows at its end.
				const key = `${index}:${block.kind}`;
				if (block.kind === "code")
					return (
						<CodeBlock key={key} maxHeight="half">
							{block.text}
						</CodeBlock>
					);
				if (block.kind === "list")
					return (
						<Stack key={key} as={block.ordered ? "ol" : "ul"} gap={4}>
							{block.items.map((item, at) => (
								<Inline key={`${at}:${item.slice(0, 12)}`} as="li" gap={8} align="baseline" wrap={false}>
									<Text tone="subtle" mono={block.ordered} variant={block.ordered ? "meta" : "body"}>
										{block.ordered ? `${at + 1}.` : "·"}
									</Text>
									<ChatMessage author="assistant">{inline(item, onOpen)}</ChatMessage>
								</Inline>
							))}
						</Stack>
					);
				return (
					<ChatMessage key={key} author="assistant" streaming={streaming && last}>
						{block.strong ? (
							<Text weight="semibold" tone="inherit">
								{inline(block.text, onOpen)}
							</Text>
						) : (
							inline(block.text, onOpen)
						)}
					</ChatMessage>
				);
			})}
		</>
	);
}
