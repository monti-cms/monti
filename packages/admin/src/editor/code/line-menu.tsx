import type { CodeBlockSettings } from "@monti-cms/core";
import { ANCHOR, COLLAPSE, type LineEffect } from "@monti-cms/core/code";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	MenuShortcut,
	MenuValue,
} from "@monti-cms/ui";
import type { Editor } from "@tiptap/react";
import { useAdmin } from "../../operations/admin-context";
import { markName } from "../schema";
import { sendCode } from "./code-state";

/** The words of a range of lines, counted from 1 ("Line 4", "Lines 4–6"). */
export function linesLabel(t: ReturnType<typeof useAdmin>["t"], start: number, end: number) {
	return end - start <= 1
		? t("editor.code.line", { n: start + 1 })
		: t("editor.code.lines", { from: start + 1, to: end });
}

/** An effect's lines with `start`–`end - 1` taken out: what is left of it, in one or two pieces. */
function without(effect: LineEffect, start: number, end: number): LineEffect[] {
	const out: LineEffect[] = [];
	if (effect.start < start) out.push({ ...effect, start: effect.start, end: Math.min(effect.end, start) });
	if (effect.end > end) out.push({ ...effect, start: Math.max(effect.start, end), end: effect.end });
	return out;
}

/** How many of the lines `start`–`end - 1` the effect is on. */
function covered(effects: readonly LineEffect[], name: string, start: number, end: number) {
	let count = 0;
	for (let line = start; line < end; line++)
		if (effects.some((effect) => effect.name === name && effect.start <= line && line < effect.end)) count++;
	return count;
}

/** A new label for a code link's lines: the next free `l1`, `l2` … of the block. */
export function freshAnchor(effects: readonly LineEffect[]) {
	const used = new Set(
		effects.flatMap((effect) => (effect.name === ANCHOR && effect.attrs?.id ? [effect.attrs.id] : [])),
	);
	let n = 1;
	while (used.has(`l${n}`)) n++;
	return `l${n}`;
}

/** The words of the text that point at a label of this block. */
function linkedWords(editor: Editor, blockId: string, anchor: string) {
	const type = editor.state.schema.marks[markName("codeRef")];
	const words: string[] = [];
	if (!type) return words;
	editor.state.doc.descendants((node) => {
		const mark = node.isText ? node.marks.find((each) => each.type === type) : null;
		if (mark && mark.attrs.block === blockId && mark.attrs.anchor === anchor) words.push(node.text ?? "");
		return true;
	});
	return words;
}

/**
 * The line menu (doc 17): opened beside the lines picked by their numbers. Each effect is a check box for all the picked lines (on all, on some with how
 * many, on none); the fold over the lines; the link to words of the text, checked with the words as its value once there is one.
 */
export function LineMenu({
	editor,
	frame,
	blockId,
	getPos,
	start,
	end,
	effects,
	settings,
	onChange,
	onClose,
}: {
	editor: Editor;
	frame: React.RefObject<HTMLDivElement | null>;
	blockId: string;
	getPos: () => number | undefined;
	start: number;
	end: number;
	effects: readonly LineEffect[];
	settings: CodeBlockSettings;
	onChange: (effects: LineEffect[]) => void;
	onClose: () => void;
}) {
	const { t } = useAdmin();
	const total = end - start;
	const offered = settings.lineEffects.filter(
		(definition) => definition.offered || effects.some((effect) => effect.name === definition.name),
	);
	const toggle = (name: string) => {
		const on = covered(effects, name, start, end) === total;
		const rest = effects.flatMap((effect) => (effect.name === name ? without(effect, start, end) : [effect]));
		onChange(on ? rest : [...rest, { name, start, end }]);
	};
	const fold = effects.find((effect) => effect.name === COLLAPSE && effect.start === start && effect.end === end);
	const crossing = effects.some(
		(effect) =>
			effect.name === COLLAPSE &&
			effect !== fold &&
			((effect.start < start && start < effect.end && effect.end < end) ||
				(start < effect.start && effect.start < end && end < effect.end)),
	);
	const anchor = effects.find((effect) => effect.name === ANCHOR && effect.start === start && effect.end === end);
	const words = anchor?.attrs?.id ? linkedWords(editor, blockId, anchor.attrs.id) : [];
	const lineRow = frame.current?.querySelector<HTMLElement>(`[data-slot=code-number][data-line="${start}"]`);
	const virtual = {
		getBoundingClientRect: () => {
			const box = frame.current?.getBoundingClientRect();
			const row = lineRow?.getBoundingClientRect();
			return new DOMRect(box?.right ?? 0, row?.top ?? box?.top ?? 0, 0, row?.height ?? 20);
		},
	};

	return (
		<DropdownMenu
			open
			modal={false}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DropdownMenuContent anchor={virtual} side="right" align="start">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{t("editor.code.lineMenu", { lines: linesLabel(t, start, end) })}</DropdownMenuLabel>
					{offered.map((definition) => {
						const count = covered(effects, definition.name, start, end);
						const some = count > 0 && count < total;
						return (
							<DropdownMenuCheckboxItem
								key={definition.name}
								box
								closeOnClick={false}
								checked={count === total}
								mixed={some}
								onCheckedChange={() => toggle(definition.name)}
							>
								{t(definition.label)}
								{some ? <MenuShortcut>{`${count}/${total}`}</MenuShortcut> : null}
							</DropdownMenuCheckboxItem>
						);
					})}
				</DropdownMenuGroup>
				{settings.tools.fold && total >= 2 ? (
					<>
						<DropdownMenuSeparator />
						{fold ? (
							<>
								<DropdownMenuItem onClick={() => onChange(effects.filter((effect) => effect !== fold))}>
									{t("editor.code.unfold")}
								</DropdownMenuItem>
								<DropdownMenuCheckboxItem
									closeOnClick={false}
									checked={fold.attrs?.open === true}
									onCheckedChange={(open) =>
										onChange(
											effects.map((effect) =>
												effect === fold
													? { ...effect, ...(open ? { attrs: { open: true as const } } : { attrs: undefined }) }
													: effect,
											),
										)
									}
								>
									{t("editor.code.openAtFirst")}
								</DropdownMenuCheckboxItem>
							</>
						) : (
							<DropdownMenuItem
								disabled={crossing}
								onClick={() => onChange([...effects, { name: COLLAPSE, start, end }])}
							>
								{t("editor.code.foldLines")}
								{crossing ? <MenuValue>{t("editor.code.foldCrosses")}</MenuValue> : null}
							</DropdownMenuItem>
						)}
					</>
				) : null}
				{settings.tools.links ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuCheckboxItem
							checked={words.length > 0}
							onCheckedChange={() => {
								const at = getPos();
								if (typeof at !== "number") return;
								onClose();
								// The lines are the first side; the strip at the top of the screen asks for the words of the text.
								sendCode(editor.view, { linking: { lines: { pos: at, start, end } } });
							}}
						>
							{t("editor.code.linkText")}
							{words.length ? <MenuValue>{t("editor.code.linkedTo", { words: words.join(" ") })}</MenuValue> : null}
						</DropdownMenuCheckboxItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
