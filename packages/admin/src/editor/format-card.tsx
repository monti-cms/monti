import {
	EditorOverlay,
	FloatingBar,
	FormatButton,
	type FormatMark,
	FormField,
	FormFieldLabel,
	IconButton,
	Inline,
	Input,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Separator,
} from "@monti-cms/ui";
import { Unlink } from "@monti-cms/ui/icons";
import { TextSelection } from "@tiptap/pm/state";
import { type Editor, useEditorState } from "@tiptap/react";
import { useState } from "react";
import { useAdmin } from "../operations/admin-context";
import type { BodyCatalogs } from "./catalog";
import { markName, nodeName } from "./schema";

/** The bar's two groups (editor-tools.md): the text formats, then the smaller ones and the link. */
const GROUPS: { type: string; mark: FormatMark; keys?: string[] }[][] = [
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
 * link opens a field for its address. Formats a site adds (the ⋯), footnotes and the assistant's request come with their own features.
 */
export function FormatCard({ editor, catalogs }: { editor: Editor; catalogs: BodyCatalogs }) {
	const { t } = useAdmin();
	const [linking, setLinking] = useState(false);
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const { selection } = current.state;
			const shown =
				current.isEditable &&
				selection instanceof TextSelection &&
				!selection.empty &&
				selection.$from.parent.type.name !== nodeName("codeBlock") &&
				(current.isFocused || linking);
			if (!shown) return null;
			const start = current.view.coordsAtPos(selection.from);
			const end = current.view.coordsAtPos(selection.to);
			const sameLine = Math.abs(start.top - end.top) < 4;
			return {
				top: Math.min(start.top, end.top) - GAP,
				left: sameLine ? (start.left + end.right) / 2 : start.left,
				active: Object.fromEntries(GROUPS.flat().map(({ type }) => [type, current.isActive(markName(type))])),
				href: String(current.getAttributes("link").href ?? ""),
			};
		},
	});
	if (!state) return null;
	const offered = new Set(catalogs.offered.marks.map((mark) => mark.type));
	const groups = GROUPS.map((group) => group.filter(({ type }) => offered.has(type))).filter((group) => group.length);
	const label = (type: string) => t(catalogs.kit.marks.find((mark) => mark.type === type)?.label ?? type);
	const toggle = (type: string) => editor.chain().focus().toggleMark(markName(type)).run();

	return (
		<EditorOverlay top={state.top} left={state.left} place="above">
			<FloatingBar aria-label={t("format.label")}>
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
									shortcut={keys as never}
									pressed={Boolean(state.active[type])}
									onClick={() => toggle(type)}
								/>
							),
						)}
					</Inline>
				))}
			</FloatingBar>
		</EditorOverlay>
	);
}

/** The link button and its field: Enter sets the address on the selected words; an empty address takes the link off. */
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
	const [value, setValue] = useState(href);
	const apply = (address: string) => {
		const chain = editor.chain().focus().extendMarkRange("link");
		(address.trim() ? chain.setLink({ href: address.trim() }) : chain.unsetLink()).run();
		onOpenChange(false);
	};
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				if (next) setValue(href);
				onOpenChange(next);
			}}
		>
			<FormatButton
				mark="link"
				label={label}
				pressed={pressed}
				trigger={(button) => <PopoverTrigger render={button} />}
			/>
			<PopoverContent side="bottom" align="center" width="md">
				<FormField>
					<FormFieldLabel htmlFor="monti-link-address">{t("format.address")}</FormFieldLabel>
					<Inline gap={8}>
						<Input
							id="monti-link-address"
							autoFocus
							mono
							value={value}
							placeholder="https://"
							onChange={(event) => setValue(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.nativeEvent.isComposing) {
									event.preventDefault();
									apply(value);
								}
							}}
						/>
						{pressed ? (
							<IconButton label={t("format.unlink")} onClick={() => apply("")}>
								<Unlink aria-hidden />
							</IconButton>
						) : null}
					</Inline>
				</FormField>
			</PopoverContent>
		</Popover>
	);
}
