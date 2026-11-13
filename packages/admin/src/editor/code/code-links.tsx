import { ANCHOR } from "@monti-cms/core/code";
import {
	Banner,
	Command,
	CommandItem,
	CommandList,
	FloatingBarButton,
	MenuValue,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { ArrowRight, CodeReference, Unlink } from "@monti-cms/ui/icons";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { type Editor, useEditorState } from "@tiptap/react";
import { useAdmin } from "../../operations/admin-context";
import { markName, nodeName } from "../schema";
import { anchorsByBlock, cleanData, codeToolsKey, dataOf, followCodeRef, sendCode } from "./code-state";
import { freshAnchor, linesLabel } from "./line-menu";

type T = ReturnType<typeof useAdmin>["t"];

/** The words of the text picked now, outside code: the text side of a link being made. */
function pickedWords(editor: Editor) {
	const { from, to, empty, $from } = editor.state.selection;
	if (empty || $from.parent.type.name === nodeName("codeBlock") || !$from.parent.isTextblock) return null;
	if (editor.state.selection.$to.parent !== $from.parent) return null;
	return { from, to };
}

/** A code block's name in a link (doc 17): its file name, or "Code block n" by its place among the body's code blocks. */
export function blockName(t: T, doc: EditorNode, blockId: string) {
	let n = 0;
	let name: string | null = null;
	doc.descendants((node) => {
		if (name !== null) return false;
		if (node.type.name !== nodeName("codeBlock")) return true;
		n++;
		if (String(node.attrs.blockId ?? "") === blockId) name = dataOf(node).title || t("editor.code.block", { n });
		return false;
	});
	return name;
}

/** Where a code link points, in words: "src/counter.tsx · Lines 4–6"; `null` when the lines are gone. */
export function targetLabel(t: T, doc: EditorNode, block: string, anchor: string) {
	const target = anchorsByBlock(doc).get(block);
	const effect = target?.effects.find((each) => each.attrs?.id === anchor);
	const name = blockName(t, doc, block);
	if (!effect || !name) return null;
	return t("editor.code.target", { name, lines: linesLabel(t, effect.start, effect.end) });
}

/** Links the words to the lines: the lines get a label (the one they have, or a new one), the words a code link to it. One step to undo. */
function link(editor: Editor) {
	const linking = codeToolsKey.getState(editor.state)?.linking;
	const words = linking?.text ?? pickedWords(editor);
	const lines = linking?.lines;
	const type = editor.state.schema.marks[markName("codeRef")];
	if (!words || !lines || !type) return;
	const block = editor.state.doc.nodeAt(lines.pos);
	if (!block || block.type.name !== nodeName("codeBlock")) return;
	const data = dataOf(block);
	const effects = data.lines ?? [];
	const same = effects.find(
		(effect) => effect.name === ANCHOR && effect.start === lines.start && effect.end === lines.end,
	);
	const anchor = same?.attrs?.id ?? freshAnchor(effects);
	const tr = editor.state.tr;
	if (!same)
		tr.setNodeAttribute(
			lines.pos,
			"data",
			cleanData({
				...data,
				lines: [...effects, { name: ANCHOR, start: lines.start, end: lines.end, attrs: { id: anchor } }],
			}),
		);
	tr.addMark(words.from, words.to, type.create({ block: String(block.attrs.blockId ?? ""), anchor }));
	tr.setMeta(codeToolsKey, { linking: null });
	editor.view.dispatch(tr);
	editor.commands.focus();
}

/**
 * The strip at the top of the screen while a code link is made (doc 17): it says which side is still to pick, "Link" once both are, and "Cancel".
 * The lines are picked by their numbers, the words in the text.
 */
export function CodeLinkBanner({ editor }: { editor: Editor | null }) {
	const { t } = useAdmin();
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			if (!current) return null;
			const linking = codeToolsKey.getState(current.state)?.linking;
			if (!linking) return null;
			const words = Boolean(linking.text ?? pickedWords(current));
			return { words, lines: Boolean(linking.lines) };
		},
	});
	if (!editor || !state) return null;
	const ready = state.words && state.lines;
	return (
		<Banner
			tone="neutral"
			title={
				ready
					? t("editor.code.linkReady")
					: state.lines
						? t("editor.code.linkPickWords")
						: t("editor.code.linkPickLines")
			}
		>
			{ready ? (
				<TextButton variant="underline" onClick={() => link(editor)}>
					{t("editor.code.link")}
				</TextButton>
			) : null}
			<TextButton onClick={() => sendCode(editor.view, { linking: null })}>{t("editor.code.cancel")}</TextButton>
		</Banner>
	);
}

/**
 * The format card's code link button (doc 17): on words with no code link it starts one (the strip asks for the lines); on words that have one it opens
 * the link's card: where it points (pressing it goes there) and "Remove link". A link whose lines are gone says so.
 */
export function CodeRefButton({ editor, label }: { editor: Editor; label: string }) {
	const { t } = useAdmin();
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const attrs = current.getAttributes(markName("codeRef"));
			if (!current.isActive(markName("codeRef"))) return { linked: null };
			const block = String(attrs.block ?? "");
			const anchor = String(attrs.anchor ?? "");
			return { linked: { block, anchor, target: targetLabel(t, current.state.doc, block, anchor) } };
		},
	});
	const linked = state.linked;
	if (!linked)
		return (
			<FloatingBarButton
				label={label}
				onClick={() => {
					const words = pickedWords(editor);
					if (words) sendCode(editor.view, { linking: { text: words } });
				}}
			>
				<CodeReference aria-hidden />
			</FloatingBarButton>
		);
	return (
		<Popover>
			<FloatingBarButton label={label} pressed trigger={(button) => <PopoverTrigger render={button} />}>
				<CodeReference aria-hidden />
			</FloatingBarButton>
			<PopoverContent side="bottom" align="center" padding="menu" width="sm">
				<Command shouldFilter={false}>
					<CommandList>
						{linked.target ? (
							<CommandItem value="follow" onSelect={() => followCodeRef(editor.view, linked.block, linked.anchor)}>
								<CodeReference aria-hidden />
								<Text truncate>{linked.target}</Text>
								<MenuValue>
									<ArrowRight aria-hidden />
								</MenuValue>
							</CommandItem>
						) : (
							<CommandItem value="broken" disabled>
								<CodeReference aria-hidden />
								<Text tone="danger">{t("editor.code.broken")}</Text>
							</CommandItem>
						)}
						<CommandItem
							value="unlink"
							onSelect={() =>
								editor.chain().focus().extendMarkRange(markName("codeRef")).unsetMark(markName("codeRef")).run()
							}
						>
							<Unlink aria-hidden />
							{t("editor.code.unlink")}
						</CommandItem>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
