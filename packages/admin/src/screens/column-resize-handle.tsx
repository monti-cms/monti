// Column width resize handle of the entries table header.
import { useTranslator } from "@monti-cms/core/site";
import { cn } from "../lib/utils/cn";
import { MAX_COLUMN_SIZE, MIN_COLUMN_SIZE } from "./entries-table-widths";
import { screensMessages } from "./messages";

/**
 * Column width resize handle. Drag the header's right edge, or focus it and press ←/→ to change by 16px. Pressing twice resets to the default width.
 */
export function ColumnResizeHandle({
	label,
	width,
	resizing,
	onStart,
	onNudge,
	onReset,
}: {
	label: string;
	width: number;
	resizing: boolean;
	onStart: (event: unknown) => void;
	onNudge: (delta: number) => void;
	onReset: () => void;
}) {
	const t = useTranslator(screensMessages);
	return (
		// biome-ignore lint/a11y/useSemanticElements: column width resizing is an operable separator, not an hr
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label={t("list.resizeColumn", { label })}
			aria-valuenow={width}
			aria-valuemin={MIN_COLUMN_SIZE}
			aria-valuemax={MAX_COLUMN_SIZE}
			aria-valuetext={`${width}px`}
			tabIndex={0}
			onMouseDown={onStart}
			onTouchStart={onStart}
			onDoubleClick={onReset}
			onKeyDown={(event) => {
				if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
					event.preventDefault();
					onNudge(event.key === "ArrowLeft" ? -16 : 16);
				}
			}}
			className="absolute top-0 right-0 z-10 flex h-full w-2 cursor-col-resize touch-none select-none justify-center outline-none"
		>
			<span
				className={cn(
					"h-full w-px bg-transparent transition-colors group-hover/th:bg-cms-border",
					resizing && "bg-cms-primary group-hover/th:bg-cms-primary",
					"[div:focus-visible>&]:bg-cms-ring",
				)}
			/>
		</div>
	);
}
