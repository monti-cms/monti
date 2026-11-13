import { CODE_TOOL_MARKS } from "@monti-cms/core";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	EditorOverlay,
	FloatingBar,
	FormatBarRequest,
	FormatButton,
	type FormatMark,
	Inline,
	MenuShortcut,
	MenuValue,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Separator,
	type ShortcutKeys,
	Text,
} from "@monti-cms/ui";
import { Document, Link, Unlink } from "@monti-cms/ui/icons";
import { TextSelection } from "@tiptap/pm/state";
import { type Editor, useEditorState } from "@tiptap/react";
import { useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import type { BodyCatalogs } from "./catalog";
import { clearFormats, hasClearableFormat, inTableCell } from "./commands";
import { insertFootnote } from "./footnotes";
import { addressOf, ENTRY_LINK, type LinkTarget, useLinkTargets } from "./link-targets";
import { type PickedText, pickedText } from "./request-marks";
import { markName, nodeName } from "./schema";

/** The bar's two groups (editor-tools.md): the text formats, then the smaller ones and the link. */
const GROUPS: { type: string; mark: FormatMark; keys?: ShortcutKeys }[][] = [
	[
		{ type: "bold", mark: "bold", keys: ["mod", "B"] },
		{ type: "italic", mark: "italic", keys: ["mod", "I"] },
		{ type: "underline", mark: "underline", keys: ["mod", "U"] },
		{ type: "strike", mark: "strike", keys: ["mod", "shift", "S"] },
		{ type: "code", mark: "code", keys: ["mod", "E"] },
	],
	[
		{ type: "sup", mark: "superscript", keys: ["mod", "."] },
		{ type: "sub", mark: "subscript", keys: ["mod", ","] },
		{ type: "link", mark: "link" },
	],
];

/** Where the bar floats: 8px over the middle of the selected words. */
const GAP = 8;

/**
 * The format card (doc 03, editor-tools.md): over selected words, the formats the collection's editor offers, each pressed when the words have it. The
 * link opens a field for its address; the footnote button puts a footnote after the words. Formats a site adds (the ⋯) and the assistant's request
 * come with their own features.
 */
export function FormatCard({
	editor,
	catalogs,
	onRequest,
}: {
	editor: Editor;
	catalogs: BodyCatalogs;
	/** "✦ Request" (⌘J): asks the assistant about the picked words (doc 10, item 28). Left out where there is no assistant to ask. */
	onRequest?: (picked: PickedText) => void;
}) {
	const { t } = useAdmin();
	const [linking, setLinking] = useState(false);
	const [more, setMore] = useState(false);
	const bar = useRef<HTMLDivElement>(null);
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const { selection } = current.state;
			const shown =
				current.isEditable &&
				selection instanceof TextSelection &&
				!selection.empty &&
				selection.$from.parent.type.name !== nodeName("codeBlock") &&
				!inTableCell(selection.$from) &&
				(current.isFocused || linking || more);
			if (!shown) return null;
			const start = current.view.coordsAtPos(selection.from);
			const end = current.view.coordsAtPos(selection.to);
			const sameLine = Math.abs(start.top - end.top) < 4;
			return {
				top: Math.min(start.top, end.top) - GAP,
				left: sameLine ? (start.left + end.right) / 2 : start.left,
				active: Object.fromEntries(catalogs.kit.marks.map(({ type }) => [type, current.isActive(markName(type))])),
				href: String(current.getAttributes("link").href ?? ""),
				clearable: hasClearableFormat(current.state),
				inFootnote: selection.$from.parent.type.name === nodeName("footnote"),
				requestable: pickedText(current.state) !== null,
			};
		},
	});
	if (!state) return null;
	const offered = new Set(catalogs.offered.marks.map((mark) => mark.type));
	const groups = GROUPS.map((group) => group.filter(({ type }) => offered.has(type))).filter((group) => group.length);
	const builtIn = new Set(GROUPS.flat().map(({ type }) => type));
	// The code tools' marks have their own places (doc 17): a code link, a fold and a tooltip in code are not the site's marks.
	const custom = catalogs.offered.marks.filter((mark) => !builtIn.has(mark.type) && !CODE_TOOL_MARKS.has(mark.type));
	const label = (type: string) => t(catalogs.kit.marks.find((mark) => mark.type === type)?.label ?? type);
	// A footnote's own text has no footnote of its own.
	const footnote = state.inFootnote ? undefined : catalogs.offered.blocks.find((block) => block.type === "footnote");
	const toggle = (type: string) => editor.chain().focus().toggleMark(markName(type)).run();

	return (
		<EditorOverlay top={state.top} left={state.left} place="above">
			<FloatingBar ref={bar} aria-label={t("format.label")}>
				{groups.map((group, at) => (
					<Inline key={group[0]?.type} gap={2}>
						{at > 0 ? <Separator orientation="vertical" length="bar" /> : null}
						{group.map(({ type, mark, keys }) =>
							type === "link" ? (
								<LinkButton
									key={type}
									editor={editor}
									label={label(type)}
									pressed={Boolean(state.active[type])}
									href={state.href}
									open={linking}
									onOpenChange={setLinking}
								/>
							) : (
								<FormatButton
									key={type}
									mark={mark}
									label={label(type)}
									shortcut={keys}
									pressed={Boolean(state.active[type])}
									onClick={() => toggle(type)}
								/>
							),
						)}
						{/* After the link: a footnote for the picked words, its number after them and its text at the end of the body. */}
						{group.some(({ type }) => type === "link") && footnote ? (
							<FormatButton
								mark="footnote"
								label={t(footnote.label)}
								onClick={() => {
									const tr = editor.state.tr;
									if (insertFootnote(tr, editor.state.selection.to)) editor.view.dispatch(tr);
									editor.commands.focus();
								}}
							/>
						) : null}
						{/* After the text formats, and only while the words have one: takes them all off at once (a link stays). */}
						{at === 0 && state.clearable ? (
							<FormatButton
								mark="clear"
								label={t("format.clear")}
								shortcut={["mod", "\\"]}
								onClick={() => {
									clearFormats(editor.state, editor.view.dispatch);
									editor.commands.focus();
								}}
							/>
						) : null}
					</Inline>
				))}
				{custom.length > 0 ? (
					<Popover open={more} onOpenChange={setMore}>
						<FormatButton
							mark="more"
							label={t("format.more")}
							trigger={(button) => <PopoverTrigger render={button} />}
						/>
						<PopoverContent anchor={bar} side="bottom" align="end" padding="menu" width="sm">
							<Command>
								<CommandList aria-label={t("format.more")}>
									<CommandGroup>
										{custom.map((mark) => (
											<CommandItem
												key={mark.type}
												value={mark.type}
												checked={Boolean(state.active[mark.type])}
												onSelect={() => toggle(mark.type)}
											>
												{label(mark.type)}
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
				) : null}
				{onRequest && state.requestable ? (
					<>
						<Separator orientation="vertical" length="bar" />
						<FormatBarRequest
							label={t("format.request")}
							onClick={() => {
								const picked = pickedText(editor.state);
								if (picked) onRequest(picked);
							}}
						/>
					</>
				) : null}
			</FloatingBar>
		</EditorOverlay>
	);
}

/**
 * The link button and its card (T63): one field, as Notion's. What is typed decides the link: an address links out, other words find the site's
 * entries, and picking one links to the entry itself (`monti:entry/<group>`), so the link holds when its address changes. Words that already link
 * show where to, and the way to take the link off.
 */
function LinkButton({
	editor,
	label,
	pressed,
	href,
	open,
	onOpenChange,
}: {
	editor: Editor;
	label: string;
	pressed: boolean;
	href: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useAdmin();
	const external = href !== "" && !href.startsWith(ENTRY_LINK);
	const [text, setText] = useState(external ? href : "");
	const [typed, setTyped] = useState(false);
	const targets = useLinkTargets({ open, text, href });
	const linked = targets.linked;
	// Opened on words that link to an entry: the field shows that entry, until something is typed.
	const shown = !typed && linked && text === "" ? linked.title : text;
	const address = addressOf(shown);
	const current = linked && shown === linked.title;
	const apply = (next: string) => {
		const chain = editor.chain().focus().extendMarkRange("link");
		(next ? chain.setLink({ href: next }) : chain.unsetLink()).run();
		onOpenChange(false);
	};
	const row = (target: LinkTarget, checked = false) => (
		<CommandItem
			key={target.group}
			value={`entry:${target.group}`}
			checked={checked}
			onSelect={() => apply(`${ENTRY_LINK}${target.group}`)}
		>
			<Document aria-hidden />
			<Text truncate>{target.title}</Text>
			<MenuValue>{target.draft ? t("format.draftIn", { collection: target.collection }) : target.collection}</MenuValue>
		</CommandItem>
	);
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				if (next) {
					setText(external ? href : "");
					setTyped(false);
				}
				onOpenChange(next);
			}}
		>
			<FormatButton
				mark="link"
				label={label}
				pressed={pressed}
				trigger={(button) => <PopoverTrigger render={button} />}
			/>
			<PopoverContent side="bottom" align="center" padding="menu" width="md">
				<Command shouldFilter={false}>
					<CommandInput
						autoFocus
						value={shown}
						placeholder={t("format.find")}
						aria-label={t("format.address")}
						onValueChange={(next) => {
							setText(next);
							setTyped(true);
						}}
					/>
					<CommandList aria-label={t("format.targets")}>
						{address ? (
							<CommandGroup heading={t("format.addressGroup")}>
								<CommandItem value="address" onSelect={() => apply(address)}>
									<Link aria-hidden />
									<Text truncate>{address.replace(/^https?:\/\//, "")}</Text>
									<MenuShortcut>↵</MenuShortcut>
								</CommandItem>
							</CommandGroup>
						) : current && linked ? (
							<CommandGroup heading={t("format.current")}>{row(linked, true)}</CommandGroup>
						) : targets.found.length > 0 ? (
							<CommandGroup heading={targets.recent ? t("format.recent") : t("format.entries")}>
								{targets.found.map((target) => row(target))}
							</CommandGroup>
						) : shown.trim() !== "" ? (
							<CommandEmpty>{t("format.noEntry")}</CommandEmpty>
						) : null}
						{pressed ? (
							<>
								<CommandSeparator />
								<CommandItem value="unlink" onSelect={() => apply("")}>
									<Unlink aria-hidden />
									{t("format.unlink")}
								</CommandItem>
							</>
						) : null}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
