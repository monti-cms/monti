"use client";

import type { ComponentProps, ReactNode, Ref } from "react";
import { BlockBox } from "./block-bar";

/**
 * A site block written in a language of its own in the editor (a formula, a diagram, a chart; editor-tools.md, the source block): its drawing in a box
 * with a 1px line, and while it is picked (`selected`: the 2px picked line around it) its source in an area of its own under the drawing, set apart by a
 * line and the muted ground, named over its field. Empty, the box says what to write (`empty`).
 */
function SourceBox({
	selected = false,
	empty,
	label,
	source,
	children,
}: {
	selected?: boolean;
	/** What the box says while there is nothing to draw ("Enter a formula"); the drawing (`children`) shows otherwise. */
	empty?: string;
	/** The source's name over its field ("Source"). */
	label: string;
	/** The source's field (and its reasons), shown while picked. */
	source: ReactNode;
	/** The drawing. */
	children?: ReactNode;
}) {
	return (
		<BlockBox selected={selected}>
			<div data-slot="source-box" contentEditable={false} className="rounded-monti-md border border-monti-default">
				<div className="overflow-x-auto p-monti-16">
					{empty !== undefined ? <p className="m-0 text-monti-body text-monti-faint">{empty}</p> : children}
				</div>
				{selected && (
					<div className="flex flex-col gap-monti-8 rounded-b-monti-md border-monti-default border-t bg-monti-muted p-monti-12">
						<span className="text-monti-caption text-monti-muted">{label}</span>
						<div className="flex flex-col gap-monti-4">{source}</div>
					</div>
				)}
			</div>
		</BlockBox>
	);
}

/** A site block's frame in the editor: what its tool row (`BlockBarPlace`) hangs off. The editor reads the pointer over it. */
function BlockFrameBox({ ref, ...props }: ComponentProps<"div"> & { ref?: Ref<HTMLDivElement> }) {
	return <div ref={ref} data-slot="block-frame" className="relative" {...props} />;
}

/**
 * A name typed in a site block itself (a callout's title, a tab's name): a one-line field 28px high (the small control height) with no line or ground
 * of its own, in the block's own letters.
 * The block's stylesheet draws it by `[data-slot="block-title"]`.
 */
function BlockTitleField(props: Omit<ComponentProps<"input">, "className" | "style">) {
	return (
		<input
			data-slot="block-title"
			className="h-monti-control-sm w-full min-w-0 border-0 bg-transparent p-0 text-inherit outline-none [font:inherit] placeholder:text-current placeholder:opacity-50"
			{...props}
		/>
	);
}

export { BlockFrameBox, BlockTitleField, SourceBox };
