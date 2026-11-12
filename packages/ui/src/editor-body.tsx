import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * The editor's text as it is written: the reading type (17 / 30), 20 under a paragraph, 32 over and 12 under a heading, list items line under line,
 * code and tables in the inner box the read-only blocks use (`DocCode`, `DocTable`). The editor engine draws plain elements (`p`, `h2`, `ul`, `pre` …)
 * and marks a state with a `data-` attribute; this part gives them their looks:
 *
 * - `data-align` (`center`, `right`): where a paragraph's or a heading's lines sit.
 * - `data-empty` with `data-placeholder`: the empty line the cursor is on says how to add a block.
 * - `data-source-placeholder`: a translation's undecided block, empty, shows the source's words it stands for in the faint ink until something is typed
 *   (doc 04).
 * - `data-menu-open`: the block whose menu is open has the block background (`Block active`).
 * - `data-untranslated`: a translation's block still in the source's words, not decided yet, in the faint ink (`Untranslated`, doc 04).
 * - `data-held`: the block being dragged stays in its place, dimmed to 40%, while a small card (`HeldBlock`) follows the pointer.
 * - `data-off`: a block the collection's editor no longer offers stays, in the faint ink, with its `data-off-label` after it.
 * - `data-box`: a block the editor shows but does not edit here, in a quiet box with its `data-box-label`: one the site no longer defines (kept
 *   as it is), or one whose own editor comes with its feature.
 * - `data-checked` on a checklist's item (`ul[data-checklist]`): its box is ticked, drawn like `Checkbox` (14px, the faint ring; ticked, the ink ring and fill).
 */
const EDITOR_BODY = cn(
	"relative flex grow flex-col text-monti-reading text-monti-default outline-none [&_.ProseMirror]:outline-none",
	"[&_.ProseMirror>*:first-child]:mt-0",
	// Text blocks.
	"[&_p]:mt-0 [&_p]:mb-monti-20",
	"[&_[data-align=center]]:text-center [&_[data-align=right]]:text-right",
	"[&_h2]:mt-monti-32 [&_h2]:mb-monti-12 [&_h2]:text-monti-heading",
	"[&_h3]:mt-monti-32 [&_h3]:mb-monti-12 [&_h3]:text-monti-title",
	"[&_h4]:mt-monti-32 [&_h4]:mb-monti-12 [&_h4]:text-monti-reading [&_h4]:font-semibold",
	// Lists: their items line under line, the marker in the margin.
	"[&_ul]:mt-0 [&_ul]:mb-monti-20 [&_ul]:list-disc [&_ul]:pl-monti-24 [&_ol]:mt-0 [&_ol]:mb-monti-20 [&_ol]:list-decimal [&_ol]:pl-monti-24",
	"[&_li]:my-0 [&_li]:pl-monti-4",
	"[&_ul[data-checklist]]:list-none [&_ul[data-checklist]]:pl-monti-4",
	"[&_ul[data-checklist]>li]:relative [&_ul[data-checklist]>li]:pl-monti-24",
	"[&_ul[data-checklist]>li]:before:absolute [&_ul[data-checklist]>li]:before:top-monti-8 [&_ul[data-checklist]>li]:before:left-0 [&_ul[data-checklist]>li]:before:size-3.5 [&_ul[data-checklist]>li]:before:cursor-pointer [&_ul[data-checklist]>li]:before:rounded-monti-sm [&_ul[data-checklist]>li]:before:border-[1.5px] [&_ul[data-checklist]>li]:before:border-monti-faint [&_ul[data-checklist]>li]:before:content-['']",
	"[&_ul[data-checklist]>li[data-checked]]:text-monti-subtle [&_ul[data-checklist]>li[data-checked]]:line-through [&_ul[data-checklist]>li[data-checked]]:before:border-monti-contrast [&_ul[data-checklist]>li[data-checked]]:before:bg-monti-emphasis",
	// A quote, code, a table and the divider.
	"[&_blockquote]:mt-0 [&_blockquote]:mb-monti-20 [&_blockquote]:border-l-2 [&_blockquote]:border-monti-strong [&_blockquote]:pl-monti-16 [&_blockquote]:text-monti-muted [&_blockquote>*:last-child]:mb-0",
	"[&_pre]:mt-0 [&_pre]:mb-monti-20 [&_pre]:overflow-x-auto [&_pre]:rounded-monti-lg [&_pre]:bg-monti-muted [&_pre]:px-monti-16 [&_pre]:py-monti-12 [&_pre]:font-mono [&_pre]:text-monti-code",
	// A table is a light grid while it is written (every cell is a place to type), its head row only bolder (editor-tools.md, the table).
	"[&_table]:mb-monti-20 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_table]:text-monti-body [&_td]:relative [&_td]:border [&_td]:border-monti-muted [&_td]:px-monti-8 [&_td]:py-monti-6 [&_td]:align-top [&_th]:relative [&_th]:border [&_th]:border-monti-muted [&_th]:px-monti-8 [&_th]:py-monti-6 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold",
	// Cells picked by dragging across them.
	"[&_.selectedCell]:bg-monti-selected",
	"[&_hr]:mt-monti-8 [&_hr]:mb-monti-24 [&_hr]:border-0 [&_hr]:border-monti-default [&_hr]:border-t",
	// Marks.
	"[&_a]:underline [&_a]:decoration-monti-strong [&_a]:underline-offset-4",
	"[&_:not(pre)>code]:rounded-monti-sm [&_:not(pre)>code]:bg-monti-muted [&_:not(pre)>code]:px-monti-4 [&_:not(pre)>code]:font-mono",
	// A footnote's number in the text (its order, `data-n`), and the footnotes together at the end under a rule, each with its number in the margin.
	"[&_[data-footnote-ref]]:cursor-pointer [&_[data-footnote-ref]]:px-px [&_[data-footnote-ref]]:align-super [&_[data-footnote-ref]]:text-monti-caption [&_[data-footnote-ref]]:text-monti-muted [&_[data-footnote-ref]]:after:content-[attr(data-n)]",
	"[&_[data-footnote]]:relative [&_[data-footnote]]:mb-monti-4 [&_[data-footnote]]:pl-monti-24 [&_[data-footnote]]:text-monti-body [&_[data-footnote]]:text-monti-muted [&_[data-footnote]]:before:absolute [&_[data-footnote]]:before:left-0 [&_[data-footnote]]:before:cursor-pointer [&_[data-footnote]]:before:content-[attr(data-n)_'.']",
	"[&_[data-footnotes-start]]:mt-monti-32 [&_[data-footnotes-start]]:border-monti-default [&_[data-footnotes-start]]:border-t [&_[data-footnotes-start]]:pt-monti-16",
	// States.
	// The source's words an undecided block of a translation stands for: in flow after the empty line, so a long one takes its lines, and one line up,
	// over the empty line, so the cursor sits on its first line where the block's own words will start. `::after`, since `::before` is the ground of
	// the block whose menu is open.
	"[&_[data-source-placeholder]]:after:pointer-events-none [&_[data-source-placeholder]]:after:-mt-[1lh] [&_[data-source-placeholder]]:after:block [&_[data-source-placeholder]]:after:text-monti-faint [&_[data-source-placeholder]]:after:content-[attr(data-source-placeholder)]",
	"[&_[data-empty]]:before:pointer-events-none [&_[data-empty]]:before:float-left [&_[data-empty]]:before:h-0 [&_[data-empty]]:before:text-monti-faint [&_[data-empty]]:before:content-[attr(data-placeholder)]",
	"[&_[data-menu-open]]:relative [&_[data-menu-open]]:isolate [&_[data-menu-open]]:before:pointer-events-none [&_[data-menu-open]]:before:absolute [&_[data-menu-open]]:before:-left-monti-8 [&_[data-menu-open]]:before:-right-monti-8 [&_[data-menu-open]]:before:inset-y-0 [&_[data-menu-open]]:before:-z-10 [&_[data-menu-open]]:before:rounded-monti-md [&_[data-menu-open]]:before:bg-monti-block [&_li[data-menu-open]]:before:-left-monti-24",
	// A list item's ground covers its marker too, as `Block active` does in the reference.
	// A selected picture shows it with its tools: the selection's ground painted over it would recolor it. Its caption, once focused, has a selection of its own.
	// A picked picture or file is drawn by its own ring: the browser's text highlight over its name says nothing (2026-11-10, owner).
	"[&_.ProseMirror-selectednode:not(:focus-within)_[data-block=image]]:selection:bg-transparent!",
	"[&_.ProseMirror-selectednode:not(:focus-within)_[data-block=file]]:selection:bg-transparent!",
	// A picture and a file stand off the next block as a paragraph does (2026-11-10, owner: 20px above them, none under, read as stuck to what follows).
	"[&_[data-block=image]]:mb-monti-20 [&_[data-block=file]]:mb-monti-20",
	"[&_[data-held]]:opacity-40",
	"[&_[data-untranslated]]:text-monti-faint",
	"[&_[data-off]]:text-monti-faint [&_[data-off]]:after:ml-monti-8 [&_[data-off]]:after:text-monti-meta [&_[data-off]]:after:content-[attr(data-off-label)]",
	"[&_[data-box]]:mb-monti-20 [&_[data-box]]:rounded-monti-lg [&_[data-box]]:bg-monti-muted [&_[data-box]]:px-monti-16 [&_[data-box]]:py-monti-12 [&_[data-box]]:text-monti-note [&_[data-box]]:text-monti-subtle [&_[data-box]]:before:content-[attr(data-box-label)]",
);

/**
 * The text laid out as the rows of `CompareRows` (translation.md, side by side): the editor's blocks are the translation cells, and the editor puts
 * before each of them, as cells it does not edit, a rule across the row (`data-pair=rule`), the block's kind with its note
 * (`data-pair=kind`, the note `data-pair-note` in its tone: `warning`, `danger` or `success`) and the source block (`data-pair=source`, on the tool ground, quieter; its changed
 * words `mark`, underlined in the warning color, its code `data-pair-code`). The block the cursor is in, and the source cell of its row, are on the block ground (`data-pair-current`) while the text has the focus. The rows take the height of their taller side.
 */
const PAIRED = cn(
	"[&_.ProseMirror]:grid [&_.ProseMirror]:grid-cols-[104px_minmax(0,1fr)_minmax(0,1fr)] [&_.ProseMirror]:items-stretch",
	// The translation cell is `CompareRow`'s: 40px before the words, so the block handle (24px, 4px off them) stays inside it.
	"[&_.ProseMirror>:not([data-pair])]:mr-monti-24 [&_.ProseMirror>:not([data-pair])]:ml-monti-40 [&_.ProseMirror>:not([data-pair])]:my-monti-16 [&_.ProseMirror>:not([data-pair])]:min-w-0",
	"[&_[data-pair=rule]]:col-span-full [&_[data-pair=rule]]:h-px [&_[data-pair=rule]]:bg-monti-muted",
	"[&_[data-pair=kind]]:flex [&_[data-pair=kind]]:flex-col [&_[data-pair=kind]]:gap-monti-2 [&_[data-pair=kind]]:py-monti-16 [&_[data-pair=kind]]:pr-monti-12 [&_[data-pair=kind]]:text-right [&_[data-pair=kind]]:font-mono [&_[data-pair=kind]]:text-monti-micro [&_[data-pair=kind]]:text-monti-subtle [&_[data-pair-note=warning]]:text-monti-warning [&_[data-pair-note=danger]]:text-monti-danger [&_[data-pair-note=success]]:text-monti-success",
	"[&_[data-pair=source]]:min-w-0 [&_[data-pair=source]]:whitespace-pre-line [&_[data-pair=source]]:border-monti-default [&_[data-pair=source]]:border-r [&_[data-pair=source]]:bg-monti-tool [&_[data-pair=source]]:px-monti-24 [&_[data-pair=source]]:py-monti-16 [&_[data-pair=source]]:text-monti-muted",
	// The source's words that changed since the translation: the warning underline of `CompareText source`.
	"[&_[data-pair=source]_mark]:bg-transparent [&_[data-pair=source]_mark]:text-inherit [&_[data-pair=source]_mark]:underline [&_[data-pair=source]_mark]:decoration-[1.5px] [&_[data-pair=source]_mark]:decoration-monti-warning [&_[data-pair=source]_mark]:underline-offset-4",
	"[&_[data-pair-heading]]:text-monti-heading [&_[data-pair-code]]:block [&_[data-pair-code]]:whitespace-pre-wrap [&_[data-pair-code]]:rounded-monti-lg [&_[data-pair-code]]:bg-monti-selected [&_[data-pair-code]]:px-monti-16 [&_[data-pair-code]]:py-monti-12 [&_[data-pair-code]]:font-mono [&_[data-pair-code]]:text-monti-code",
	// Only while the text has the cursor (the editor marks its root `ProseMirror-focused` then), the row of the block the cursor is in is on the block
	// ground on both sides (`bg-block`, the ground of the block a handle or menu is about); words picked in it take the stronger `bg-selection`: the source cell itself, and under the translation cell a ground the source cell lays to its right (the columns are equal),
	// behind the block, so the block keeps its own looks (a code block's box) and nothing in it overflows.
	"[&_.ProseMirror]:isolate [&_[data-pair=source]]:relative",
	"[&_.ProseMirror-focused>[data-pair=source]:has(+[data-pair-current])]:bg-monti-block",
	"[&_.ProseMirror-focused>[data-pair=source]:has(+[data-pair-current])]:after:absolute [&_.ProseMirror-focused>[data-pair=source]:has(+[data-pair-current])]:after:top-0 [&_.ProseMirror-focused>[data-pair=source]:has(+[data-pair-current])]:after:left-full [&_.ProseMirror-focused>[data-pair=source]:has(+[data-pair-current])]:after:-z-10 [&_.ProseMirror-focused>[data-pair=source]:has(+[data-pair-current])]:after:h-full [&_.ProseMirror-focused>[data-pair=source]:has(+[data-pair-current])]:after:w-[calc(100%+1px)] [&_.ProseMirror-focused>[data-pair=source]:has(+[data-pair-current])]:after:bg-monti-block [&_.ProseMirror-focused>[data-pair=source]:has(+[data-pair-current])]:after:content-['']",
);

/** The lines that stand for a body not shown yet: three bars at the reading line's pitch, the last one short. */
const WAIT_LINE = "h-monti-12 animate-pulse rounded-monti-full bg-monti-selected";

/**
 * The editor's text column: what the editor engine draws goes inside, and takes the body's looks from here. `paired` lays the text out as rows beside
 * its source (a translation side by side). `settling` keeps the text unseen while its place is held: the pictures of an opened body are not
 * read yet, and drawn now the text would jump when their shapes come. Three grey lines stand in its place, and only once the wait is long enough
 * to be seen (200ms): a body that is ready at once shows no flash of them.
 */
function EditorBody({
	paired = false,
	settling = false,
	className,
	children,
	...props
}: ComponentProps<"div"> & { paired?: boolean; settling?: boolean }) {
	return (
		<div
			data-slot="editor-body"
			data-paired={paired || undefined}
			aria-busy={settling || undefined}
			className={cn(
				EDITOR_BODY,
				paired && PAIRED,
				settling && "[&>:not([data-slot=editor-body-wait])]:invisible",
				className,
			)}
			{...props}
		>
			{settling && (
				<div
					data-slot="editor-body-wait"
					aria-hidden="true"
					className="fade-in-0 pointer-events-none absolute inset-x-0 top-0 flex animate-in flex-col gap-monti-16 fill-mode-both py-monti-8 delay-(--monti-duration-slow)"
				>
					<span className={WAIT_LINE} />
					<span className={WAIT_LINE} />
					<span className={cn(WAIT_LINE, "w-3/5")} />
				</div>
			)}
			{children}
		</div>
	);
}

export { EditorBody };
