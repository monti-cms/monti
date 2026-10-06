"use client";

import type { Field, TextChecker } from "@monti-cms/core/client";
import type { StoredDocument } from "@monti-cms/core/document";
import type { FormatIssue } from "@monti-cms/core/format";
import type { ListEntriesItem } from "@monti-cms/core/runtime";
import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import {
	type ComponentType,
	createContext,
	Fragment,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
} from "react";
import type { BrowserFormat } from "./browser-format";
import type { EditorMarkSpec } from "./editor/added-marks";
import type { BlockView } from "./editor/blocks/use-block-editor";
import type { ActiveInlineMark } from "./editor/inline-marks";
import { useTextCheckEditor } from "./editor/text-check/extension";
import type { BlockAction } from "./editor/tiptap-editor";
import type { EntryData, EntryForm } from "./screens/entries/entry-form";
import type { FieldInputProps } from "./screens/entries/field-inputs";

/**
 * The current context received by edit screen extensions (plugins, etc.). It is a hook called on every render, so React hooks may be used inside.
 * The extension list must not change while the admin UI is shown (hook order).
 */
export interface EditorExtensionContext {
	/** The source and translation languages when editing a translation. `null` for the original. */
	readonly translateLocales: { readonly sourceLocale: string; readonly targetLocale: string } | null;
	/** The entry being edited (title, collection, language, ID), read on click. */
	readonly getEntry?: () => {
		readonly title: string;
		readonly collection: string;
		readonly locale?: string;
		readonly entryId?: string;
	};
}

/** An action added to the inline menu that appears when text is selected (e.g. polishing the writing style). */
export interface EditorSelectionAction {
	readonly id: string;
	readonly label: string;
	readonly icon: ReactNode;
	readonly run: (editor: Editor) => void;
}

/** An insert action added to the slash (`/`) menu (e.g. writing a draft). `range` is the typed `/query` span. */
export interface EditorInsertAction {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly keywords: readonly string[];
	/** Menu icon (lucide name or component). Defaults to a puzzle icon. */
	readonly icon?: string | LucideIcon;
	readonly run: (editor: Editor, range: { from: number; to: number }) => void;
}

/**
 * What an edit screen extension adds: an element at the end of the toolbar, an action next to the block handle, actions for the selection menu and slash menu,
 * and functions to receive when the editor is created and destroyed.
 */
export interface EditorExtensionResult {
	readonly toolbar?: ReactNode;
	/**
	 * An element rendered once outside the toolbar (dialog, etc.). Toolbar elements may be re-rendered depending on width,
	 * so anything that must keep its state while open belongs here.
	 */
	readonly overlay?: ReactNode;
	readonly blockActions?: readonly BlockAction[];
	readonly selectionActions?: readonly EditorSelectionAction[];
	readonly insertActions?: readonly EditorInsertAction[];
	readonly onEditor?: (editor: Editor | null) => void;
}

export type EditorExtension = (context: EditorExtensionContext) => EditorExtensionResult;

/** An input panel expanded inside the inline bubble (like the link input). */
export interface EditorBubblePanel {
	/** Panel name (for screen readers). */
	readonly label: string;
	/** `form` is the input form width (20rem), `auto` is content width. Defaults to `form`. */
	readonly size?: "form" | "auto";
	readonly content: ReactNode;
}

/** Values received by inline bubble buttons and content. */
export interface EditorBubbleProps {
	readonly editor: Editor;
	/** Whether the selection is inside a code block. */
	readonly inCode: boolean;
	/** Expands an input panel inside the bubble. */
	readonly openPanel: (panel: EditorBubblePanel) => void;
	/** Closes the expanded panel and returns focus to the editor. */
	readonly closePanel: () => void;
	/** Wraps an action that changes the document. The bubble does not disappear after the change (it is not treated as input). */
	readonly act: (run: () => void) => () => void;
}

/** Values received by the content to render in the bubble when the cursor is inside a mark. `mark` is that mark and its range around the cursor. */
export interface EditorMarkDetailProps extends EditorBubbleProps {
	readonly mark: ActiveInlineMark;
}

/**
 * What a text mark extension (a block extension's `syntax.kind: "text"` block) adds to the editor. The key is the block name, and the editor mark name is
 * `cms` + the Pascal-case block name (`addedMarkName` in `@monti-cms/admin/editor`). The core editor does not know mark names and only renders these registrations.
 */
export interface EditorMarkExtension extends EditorMarkSpec {
	/**
	 * Formatting tool button. `format` goes after the text marks (bold...), `link` after the link. If `priority` is set, when space is tight the larger values go first into
	 * the "More" menu (`MenuItems`); without it, the button is never hidden.
	 */
	readonly toolbar?: {
		readonly group: "format" | "link";
		readonly priority?: number;
		readonly Button: ComponentType<{ readonly editor: Editor }>;
		readonly MenuItems?: ComponentType<{ readonly editor: Editor }>;
	};
	/**
	 * A button to add to the inline bubble when text is selected. `format` goes after the text marks, `link` goes in the link group in `order`
	 * (link is 0, default 1).
	 */
	readonly bubble?: {
		readonly group: "format" | "link";
		readonly order?: number;
		readonly Button: ComponentType<EditorBubbleProps>;
	};
	/** Content to render in the bubble when the cursor is inside this mark (description, edit, remove). If absent, nothing appears in the bubble. */
	readonly detail?: ComponentType<EditorMarkDetailProps>;
	/** Slash (`/`) menu items. Placed after the default text format items and before the block items. */
	readonly insertActions?: readonly EditorInsertAction[];
}

export type { BrowserExportOptions, BrowserFormat, BrowserImportResult } from "./browser-format";

/**
 * What a source panel receives. The panel edits the body as text in the notation of its format and hands the result back as a stored document: the
 * document is the only source, and the panel parses in the browser (`onChange` gets the findings at once). A text it cannot read is handed back as a
 * document holding that text in one `unparsed` node, with the findings in `issues`, so a draft can keep it.
 */
export interface SourcePanelProps {
	/** The body being edited. A change that did not come from this panel replaces the text the panel shows. */
	readonly doc: StoredDocument;
	/** The text changed: the document it reads as (its blocks keep the ids of `doc` where they pair up), and what was found about the text. */
	readonly onChange: (doc: StoredDocument, issues: readonly FormatIssue[]) => void;
	/** The block to bring the caret to: the id of a block of `doc`. */
	readonly focusBlock?: string;
	/** True when the body cannot be edited (the trash). */
	readonly readOnly?: boolean;
	/** The panel's input started or finished an IME composition. A save waits for the composition to end. */
	readonly onComposing?: (composing: boolean) => void;
}

/** Id of the element a screen puts the findings about the text in. A source panel's input refers to it as its description (`aria-describedby`). */
export const SOURCE_ERROR_ID = "cms-source-error";

/** A source panel a plugin registers (`CmsAdminComponents.sourcePanels`). */
export interface SourcePanelRegistration {
	/** The format the panel edits (`mdx`). */
	readonly format: string;
	/** Name of the panel, for its toggle in the editor toolbar. */
	readonly label: string;
	readonly Panel: ComponentType<SourcePanelProps>;
}

/**
 * Components a site or plugin puts in the admin UI. Provided inside the admin layout with `CmsAdminComponentsProvider`.
 * A server layout cannot pass functions to the browser, so a client component renders this provider.
 * Nested providers add inner values to outer ones (inner wins on the same name).
 */
export interface CmsAdminComponents {
	/**
	 * Editor preview of a code fence block (e.g. `mermaid`, `chart`). The key is the fence language, and the value is a function that loads
	 * a component that renders the source (`source`) (a heavy renderer is loaded only when the preview opens). If absent, the source is shown as is.
	 */
	readonly fencePreviews?: Readonly<
		Record<string, () => Promise<ComponentType<{ readonly source: string; readonly className?: string }>>>
	>;
	/**
	 * Field input. Rendered when a collection definition's field `input` points to this name. A component replaces the default input
	 * (e.g. `fields.text({ input: "color" })` + `fieldInputs: { color: ColorInput }`); parts (`FieldInputParts`) keep the default input and
	 * change only the hint text and the right side of the label row.
	 */
	readonly fieldInputs?: Readonly<Record<string, FieldInputEntry>>;
	/**
	 * Edit view of a block. The one place a block's editing UI is registered, for every block: the core image, file and math blocks and the blocks
	 * added by block extensions or site config (`editor.view: "node"`). The key is the block name (`image`, `file`, `math`, `callout`, ...).
	 * A view registered here replaces the default view of that block.
	 *
	 * A view takes no props. It reads and writes its block with `useBlockEditor`, draws the nested body of a container with `Content`, and
	 * wraps itself in `BlockFrame` (all from `@monti-cms/admin/hooks`). Without a registered view, a core block uses its default view and any
	 * other added block the default box holding the block name, attribute inputs and body.
	 *
	 * @experimental
	 */
	readonly blockViews?: Readonly<Record<string, BlockView>>;
	/** Edit screen extension (toolbar, block actions). */
	readonly editorExtensions?: readonly EditorExtension[];
	/**
	 * Text checkers (spelling, sentences, etc.; `defineTextChecker`, `remoteTextChecker`). The editor creates a toolbar button for each checker
	 * and renders results as wavy underlines and a results window. If no checker checks that text's language, nothing is shown.
	 */
	readonly textCheckers?: readonly TextChecker[];
	/**
	 * Text mark extensions (block name -> look, format tool, bubble, slash menu). Added by a block extension's text mark (`syntax.kind: "text"`) blocks.
	 * An unregistered mark is saved and edited with the default look (unstyled text) and has no tools.
	 */
	readonly marks?: Readonly<Record<string, EditorMarkExtension>>;
	/**
	 * Icons chosen by name (lucide name -> component). Register here when a block definition's `editor.icon`, a plugin sidebar item's `icon`,
	 * a collection's `icon` or a code line effect's `icon` uses a name missing from the core list.
	 */
	readonly icons?: Readonly<Record<string, LucideIcon>>;
	/**
	 * Screens rendered by view fields (`fields.view({ view })`) (name -> component). Registered by extensions.
	 * Receives the value being entered (`form`) and the saved entry (`entry`).
	 */
	readonly fieldViews?: Readonly<Record<string, ComponentType<FieldViewProps>>>;
	/**
	 * List cells (name -> component). The name is a list column name (a field or system column name listed in `list.columns`) or the field's `input`
	 * name (column name takes precedence). Unregistered columns use the default cell: select shows option labels, text a short excerpt, relation the name, date the date.
	 */
	readonly listCells?: Readonly<Record<string, ComponentType<ListCellProps>>>;
	/**
	 * Source panels: edit the body as text in a notation (MDX, Markdown…). The editor shows a toggle for the panel only when one is registered; with several, the
	 * first registered is used. The stored document stays the only source: the panel reads and writes documents (`SourcePanelProps`).
	 */
	readonly sourcePanels?: readonly SourcePanelRegistration[];
	/** Formats the browser can read and write (name → format). Ask for one with `useFormat`. */
	readonly formats?: Readonly<Record<string, BrowserFormat>>;
}

/** Values received by a list cell component. */
export interface ListCellProps {
	readonly collection: string;
	/** Column name (field name or system column). */
	readonly column: string;
	/** The field definition for a field column. `undefined` for a system column. */
	readonly field?: Field;
	/** The entry of that row. */
	readonly entry: ListEntriesItem;
	/** The value stored as text for a field column (relations are in `entry.relations`). `undefined` when there is no value. */
	readonly value?: string;
}

/**
 * Field input parts that keep the default input and change only some. All can read the value being entered (`FieldInputProps.form`).
 */
export interface FieldInputParts {
	/** Input. If absent, the field type's default input; `null` renders only the label row with no input row (when the toggle goes in `Aside`). */
	readonly Input?: ComponentType<FieldInputProps> | null;
	/** Right side of the label row (character count, switch, etc.). Comes before the field's action buttons. */
	readonly Aside?: ComponentType<FieldInputProps>;
	/** Hint text of the default input. Returning `undefined` uses the field's `placeholder`. */
	readonly placeholder?: (props: FieldInputProps) => string | undefined;
}

/** One field input registration: a whole input (component) or parts. */
export type FieldInputEntry = ComponentType<FieldInputProps> | FieldInputParts;

/** Whether the registered value is input parts (a plain object, not a component). */
export const isFieldInputParts = (entry: FieldInputEntry): entry is FieldInputParts =>
	typeof entry === "object" && entry !== null && !("$$typeof" in entry);

/** Values received by a view field screen. */
export interface FieldViewProps {
	readonly collection: string;
	readonly form: EntryForm;
	readonly entry: EntryData | null;
}

const CmsAdminComponentsContext = createContext<CmsAdminComponents>({});

export function CmsAdminComponentsProvider({
	components,
	children,
}: {
	components: CmsAdminComponents;
	children: ReactNode;
}) {
	const parent = useContext(CmsAdminComponentsContext);
	const value = useMemo<CmsAdminComponents>(
		() => ({
			fencePreviews: { ...parent.fencePreviews, ...components.fencePreviews },
			fieldInputs: { ...parent.fieldInputs, ...components.fieldInputs },
			blockViews: { ...parent.blockViews, ...components.blockViews },
			editorExtensions: [...(parent.editorExtensions ?? []), ...(components.editorExtensions ?? [])],
			textCheckers: [...(parent.textCheckers ?? []), ...(components.textCheckers ?? [])],
			marks: { ...parent.marks, ...components.marks },
			icons: { ...parent.icons, ...components.icons },
			fieldViews: { ...parent.fieldViews, ...components.fieldViews },
			listCells: { ...parent.listCells, ...components.listCells },
			sourcePanels: [...(parent.sourcePanels ?? []), ...(components.sourcePanels ?? [])],
			formats: { ...parent.formats, ...components.formats },
		}),
		[parent, components],
	);
	return <CmsAdminComponentsContext.Provider value={value}>{children}</CmsAdminComponentsContext.Provider>;
}

export const useCmsAdminComponents = () => useContext(CmsAdminComponentsContext);

/**
 * The browser side of a format by name (`mdx`), or `undefined` when no plugin registered it. The format is a plugin's: code that needs a notation (AI, the
 * source panel) asks for it here instead of importing a parser.
 */
export const useFormat = (name: string): BrowserFormat | undefined => useCmsAdminComponents().formats?.[name];

/** The format of the registered source panel (the notation a body is shown as text in), or `undefined` when no panel is registered. */
export function useSourceFormat(): BrowserFormat | undefined {
	const { sourcePanels, formats } = useCmsAdminComponents();
	const name = sourcePanels?.[0]?.format;
	return name === undefined ? undefined : formats?.[name];
}

const NO_CHECKERS: readonly TextChecker[] = [];

/** Calls all registered edit screen extensions and text check screens and merges them into one. */
export function useEditorExtensions(context: EditorExtensionContext): Required<EditorExtensionResult> {
	const { editorExtensions = [], textCheckers = NO_CHECKERS } = useCmsAdminComponents();
	// The extension list stays the same while the admin UI is shown. Every render calls the same number of hooks in the same order.
	const results = [
		...editorExtensions.map((extension) => extension(context)),
		useTextCheckEditor(textCheckers, context),
	];
	const editorCallbacks = results.flatMap((result) => (result.onEditor ? [result.onEditor] : []));
	const callbacksRef = useRef(editorCallbacks);
	callbacksRef.current = editorCallbacks;
	const onEditor = useCallback((editor: Editor | null) => {
		for (const callback of callbacksRef.current) callback(editor);
	}, []);
	return {
		// biome-ignore lint/suspicious/noArrayIndexKey: the extension list and its order do not change
		toolbar: results.map((result, index) => <Fragment key={index}>{result.toolbar}</Fragment>),
		// biome-ignore lint/suspicious/noArrayIndexKey: the extension list and its order do not change
		overlay: results.map((result, index) => <Fragment key={index}>{result.overlay}</Fragment>),
		blockActions: results.flatMap((result) => result.blockActions ?? []),
		selectionActions: results.flatMap((result) => result.selectionActions ?? []),
		insertActions: results.flatMap((result) => result.insertActions ?? []),
		onEditor,
	};
}
