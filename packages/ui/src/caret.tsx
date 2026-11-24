import { cn } from "./cn";

/**
 * The fold-out mark after a text button that opens a list (filter, sort, changed places, move to folder, pick a model). 12px, 6px from the text and
 * centered on it. Use `solo` when the caret is all the button holds, and `ink` on a dark surface where it follows the text color.
 * A text character ▾ is too small and reads as decoration, so it is not used.
 *
 * `edge="end"`: 줄을 끝내는 갈매기(목록 바닥 줄의 "25개씩 ▾"). 선의 끝(16 중 12.8, 둥근 끝 포함)부터 상자 끝까지의 2.4px만큼 밖으로 나가, 보이는 끝이 줄의
 * 끝선에 선다(2026-11-24 소유자 결정). 화면 픽셀에 붙어 그려지므로 2px로 둔다(2.5px이면 반 픽셀 넘어간다).
 */
export function Caret({
	solo = false,
	ink = false,
	edge,
	className,
}: {
	solo?: boolean;
	ink?: boolean;
	edge?: "end";
	className?: string;
}) {
	return (
		<svg
			data-slot="caret"
			aria-hidden="true"
			focusable="false"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={cn(
				"inline-block size-3 shrink-0 align-[-1px]",
				solo ? "ml-0" : "ml-monti-6",
				ink ? "text-current" : "text-monti-subtle",
				edge === "end" && "-me-[2px]",
				className,
			)}
		>
			<path d="M4 6l4 4 4-4" />
		</svg>
	);
}
