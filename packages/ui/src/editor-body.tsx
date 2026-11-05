import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * The editor's text as it is written: the reading type (17 / 30), 20 under a paragraph, 32 over and 12 under a heading, list items line under line,
 * code and tables in the inner box the read-only blocks use (`DocCode`, `DocTable`). The editor engine draws plain elements (`p`, `h2`, `ul`, `pre` …)
 * and marks a state with a `data-` attribute; this part gives them their looks:
 *
 * - `data-align` (`center`, `right`): where a paragraph's or a heading's lines sit.
 * - `data-empty` with `data-placeholder`: the empty line the cursor is on says how to add a block.
 * - `data-menu-open`: the block whose menu is open has the block background (`Block active`).
 * - `data-held`: the block being dragged stays in its place, dimmed to 40%, while a small card (`HeldBlock`) follows the pointer.
 * - `data-off`: a block the collection's editor no longer offers stays, in the faint ink, with its `data-off-label` after it.
 * - `data-box`: a block the editor shows but does not edit here, in a quiet box with its `data-box-label`: one the site no longer defines (kept
 *   as it is), or one whose own editor comes with its feature.
 * - `data-checked` on a checklist's item (`ul[data-checklist]`): its box is ticked, drawn like `Checkbox` (14px, the faint ring; ticked, the ink ring and fill).
 */
const EDITOR_BODY = cn(
	"flex grow flex-col text-monti-reading text-monti-default outline-none [&_.ProseMirror]:outline-none",
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
	"[&_table]:mb-monti-20 [&_table]:w-full [&_table]:border-collapse [&_table]:text-monti-body [&_td]:border-monti-muted [&_td]:border-b [&_td]:px-monti-8 [&_td]:py-monti-6 [&_th]:border-monti-default [&_th]:border-b [&_th]:px-monti-8 [&_th]:py-monti-6 [&_th]:text-left [&_th]:font-semibold",
	"[&_hr]:mt-monti-8 [&_hr]:mb-monti-24 [&_hr]:border-0 [&_hr]:border-monti-default [&_hr]:border-t",
	// Marks.
	"[&_a]:underline [&_a]:decoration-monti-strong [&_a]:underline-offset-4",
	"[&_:not(pre)>code]:rounded-monti-sm [&_:not(pre)>code]:bg-monti-muted [&_:not(pre)>code]:px-monti-4 [&_:not(pre)>code]:font-mono",
	"[&_[data-footnote-ref]]:text-monti-muted [&_[data-footnote-ref]]:align-super [&_[data-footnote-ref]]:text-monti-caption",
	"[&_[data-footnote]]:text-monti-body [&_[data-footnote]]:text-monti-muted",
	// States.
	"[&_[data-empty]]:before:pointer-events-none [&_[data-empty]]:before:float-left [&_[data-empty]]:before:h-0 [&_[data-empty]]:before:text-monti-faint [&_[data-empty]]:before:content-[attr(data-placeholder)]",
	"[&_[data-menu-open]]:relative [&_[data-menu-open]]:isolate [&_[data-menu-open]]:before:pointer-events-none [&_[data-menu-open]]:before:absolute [&_[data-menu-open]]:before:-left-monti-8 [&_[data-menu-open]]:before:-right-monti-8 [&_[data-menu-open]]:before:inset-y-0 [&_[data-menu-open]]:before:-z-10 [&_[data-menu-open]]:before:rounded-monti-md [&_[data-menu-open]]:before:bg-monti-block [&_li[data-menu-open]]:before:-left-monti-24",
	// A list item's ground covers its marker too, as `Block active` does in the reference.
	"[&_[data-held]]:opacity-40",
	"[&_[data-off]]:text-monti-faint [&_[data-off]]:after:ml-monti-8 [&_[data-off]]:after:text-monti-meta [&_[data-off]]:after:content-[attr(data-off-label)]",
	"[&_[data-box]]:mb-monti-20 [&_[data-box]]:rounded-monti-lg [&_[data-box]]:bg-monti-muted [&_[data-box]]:px-monti-16 [&_[data-box]]:py-monti-12 [&_[data-box]]:text-monti-note [&_[data-box]]:text-monti-subtle [&_[data-box]]:before:content-[attr(data-box-label)]",
);

/** The editor's text column: what the editor engine draws goes inside, and takes the body's looks from here. */
function EditorBody({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="editor-body" className={cn(EDITOR_BODY, className)} {...props} />;
}

export { EditorBody };
