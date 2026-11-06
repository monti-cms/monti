/**
 * What a person must be able to do with each kind of part, written before anyone remembers to try it (2026-11-06). A screen that uses a part of a
 * kind gets that kind's scenes as tests; `pnpm check:scenes` will enforce it. Tests name the scene first in their title: `it("[reach] …")`.
 *
 * Where a scene is tested follows where the code that can break it lives:
 * - `ui`: the part's own behaviour, once, in `packages/ui` (L3, `*.browser.test.tsx`). A menu that scrolls to its highlighted row does so on every screen.
 * - `admin`: how a screen places and wires the part, in `packages/admin` next to that code (L4, `*.screen.test.tsx`). Whether the pointer can reach a
 *   + strip depends on where the screen puts it and what it listens to.
 *
 * Scenes come from six questions, asked of every kind: reach (how does it show, how does one get to it), input (mouse only, keyboard only), amount
 * (none, one, many, too many), place (where it is opened), after (the screen and the caret once it is done), interrupt (Esc, a press outside, scrolling
 * away). Keyboard scenes follow the WAI-ARIA Authoring Practices (APG) patterns named per kind. A defect that got past us becomes a scene here, with
 * where it was found, so it is tried every time after.
 *
 * Changing this file changes what every screen must be tried with: the owner approves it in the PR.
 */

type Axis = "reach" | "input" | "amount" | "place" | "after" | "interrupt";

type Scene = {
	axis: Axis;
	/** What the person does, and what must hold. */
	does: string;
	/** Defects this scene would have caught: the PR they were found in and what the person saw. */
	caught?: string[];
};

export const SCENES = {
	"keys-to-end": {
		axis: "input",
		does: "Arrow down from the first row to the last and back up: the highlighted row is always in view, and Enter runs it.",
		caught: ["#448: the '/' menu did not scroll with the arrow keys; the highlight went out of sight"],
	},
	"esc-closes": {
		axis: "interrupt",
		does: "Esc closes it and the focus goes back where it was before it opened; nothing was run.",
	},
	many: {
		axis: "amount",
		does: "With many rows or items it stays inside the window and scrolls itself; nothing is cut off at the window's edge.",
	},
	"every-row-marked": {
		axis: "amount",
		does: "Every built-in row carries its mark, like its neighbours: a row added later is not the one without an icon.",
		caught: ["#448: the table row of the '/' menu had no icon"],
	},
	reach: {
		axis: "reach",
		does: "Move the pointer the way a hand does, from where the thing shows (over the table, the block) to it, crossing every gap, and press it.",
		caught: ["#448: the table's + strip on the right hid when the pointer left the body on its way there"],
	},
	leave: {
		axis: "interrupt",
		does: "Move the pointer away: it hides, and it does not stay behind over another block.",
	},
	"line-start": {
		axis: "place",
		does: "Open it at the start of an empty line.",
	},
	"mid-sentence": {
		axis: "place",
		does: "Open it in the middle of a sentence, between words already written: it opens there, and what it puts in goes right there.",
		caught: ["#448: '/' opened only on an empty line, so a footnote could not be put after a word"],
	},
	"in-block": {
		axis: "place",
		does: "Open it inside a list item, a quote and a table cell: it opens, or it is deliberately off there.",
	},
	korean: {
		axis: "input",
		does: "Type the words that find a row in Korean through an input method (composing syllables), then Enter.",
	},
	"overflow-after-add": {
		axis: "after",
		does: "Add several (columns, rows, chips): it still fits its column, with no scroll bar and nothing pushed past the page.",
		caught: ["#448: one column added to a table pushed it past the body with a half-hidden scroll bar"],
	},
	dragging: {
		axis: "reach",
		does: "Mid-drag: what is dragged stays under the pointer, and nothing else moves except to make room.",
		caught: ["#446: a list column grew to the left, away from the pointer"],
	},
	dropped: {
		axis: "after",
		does: "Let go: it stays where it was dropped, and the page around it is unchanged.",
	},
	"esc-cancels": {
		axis: "interrupt",
		does: "Esc while dragging puts it back where it was.",
	},
	"keys-move": {
		axis: "input",
		does: "Move it with the keyboard alone (arrows, or the part's keys) and land in the same place a drag would.",
	},
} satisfies Record<string, Scene>;

export type SceneId = keyof typeof SCENES;

type Kind = {
	/** What the kind is, in a person's words. */
	what: string;
	/** The `@monti-cms/ui` parts that make a screen use this kind. */
	parts: string[];
	/** Admin code that makes its own part of this kind (a hook or a component of the admin). */
	adminCode?: string[];
	/** The APG pattern its keys follow, when it has keys. */
	apg?: string;
	/** Scenes tried on the part itself, in `packages/ui`. */
	ui: SceneId[];
	/** Scenes tried where a screen places and wires it, in `packages/admin`. */
	admin: SceneId[];
};

export const KINDS = {
	menuList: {
		what: "a list of rows picked with the arrow keys: menus, command lists, selects",
		parts: ["Command", "CommandList", "DropdownMenuContent", "ContextMenuContent", "SelectContent", "ComboboxContent"],
		apg: "Menu and Menubar; Listbox; Combobox",
		ui: ["keys-to-end", "esc-closes", "many"],
		admin: [],
	},
	floating: {
		what: "things that show over the page while the pointer is near: the block handle, a table's grips and + strips, borders to drag",
		parts: ["EditorOverlay", "BlockHandle", "TableAddStrip", "TableGrip", "TableColumnBorder"],
		ui: [],
		admin: ["reach", "leave"],
	},
	inTextTrigger: {
		what: "menus and cards opened from inside the text, the focus staying in the text: the '/' menu, the format card",
		parts: [],
		adminCode: ["useSlashMenu", "FormatCard"],
		apg: "Combobox (the text keeps the focus and moves the highlight)",
		ui: [],
		admin: ["line-start", "mid-sentence", "in-block", "korean", "keys-to-end", "every-row-marked", "esc-closes"],
	},
	growing: {
		what: "things a person makes bigger: a table's columns and rows, chips, tabs",
		parts: ["TableAddStrip", "ComboboxChips", "TagInput", "FolderTabs"],
		ui: ["many"],
		admin: ["overflow-after-add"],
	},
	drag: {
		what: "things moved or resized by dragging: sortable rows and tabs, column edges, pane edges",
		parts: ["Sortable", "SortableList", "useSortableItem", "TableColumnBorder", "ResizablePane", "ListHead"],
		ui: ["dragging", "dropped", "esc-cancels", "keys-move"],
		admin: ["dragging", "dropped"],
	},
} satisfies Record<string, Kind>;
