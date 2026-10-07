"use client";

import { BlockFrame, type BlockView, Content, useBlockEditor } from "@monti-cms/admin/hooks";

const LEVELS = ["info", "warning"] as const;
type Level = (typeof LEVELS)[number];
const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);

const LEVEL_CLASS: Record<Level, string> = {
	info: "border-sky-500 bg-sky-50 dark:bg-sky-950",
	warning: "border-amber-500 bg-amber-50 dark:bg-amber-950",
};

/**
 * The edit view of a `notice` block: an editable title, a level switch, and the nested body edited in place. A view takes no props: it reads and
 * writes its block with `useBlockEditor()`, draws the nested body with `<Content />` and wraps itself in `<BlockFrame>`.
 *
 * The block itself is yours to define in `monti.config.ts`: `defineBlock({ name: "notice", syntax: { kind: "container", directive: "notice" },
 * attributes: { title: ..., level: ... }, ... })` with a `level` attribute of `info` or `warning`.
 */
export function NoticeBlockView() {
	const block = useBlockEditor<{ title: string; level: string }>();
	const { values, editable } = block;
	const level = isLevel(values.level) ? values.level : "info";
	return (
		<BlockFrame className="my-6 rounded-lg">
			<div role="note" data-level={level} className={`not-prose rounded-lg border-l-4 px-4 py-3 ${LEVEL_CLASS[level]}`}>
				<div className="flex items-center gap-2" contentEditable={false}>
					<input
						aria-label="Notice title"
						className="flex-1 bg-transparent font-medium outline-none"
						value={typeof values.title === "string" ? values.title : ""}
						placeholder="Notice"
						readOnly={!editable}
						onChange={(event) => block.setValue("title", event.target.value)}
					/>
					{editable ? (
						<select
							aria-label="Notice level"
							className="rounded border border-neutral-300 bg-transparent px-1 text-sm dark:border-neutral-700"
							value={level}
							onChange={(event) => block.setValue("level", event.target.value)}
						>
							{LEVELS.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					) : null}
				</div>
				<Content className="mt-2 text-sm [&_p]:m-0" />
			</div>
		</BlockFrame>
	);
}

/** Spread into the `blockViews` of your admin components: `{ blockViews: { ...noticeBlockViews } }`. */
export const noticeBlockViews: Readonly<Record<string, BlockView>> = { notice: NoticeBlockView };
