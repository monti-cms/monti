import { AlertCircle, AlertOctagon, AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { ComponentType } from "react";

/** 콜아웃 블록의 종류(블록 정의 `callout.variant`의 선택지). */
export type CalloutVariant = "note" | "tip" | "info" | "warning" | "danger";

/** 편집기의 콜아웃 아이콘. 공개 화면의 모양은 사이트의 렌더러가 정한다. */
export const CALLOUT_ICON_BY_VARIANT: Record<CalloutVariant, ComponentType<{ className?: string }>> = {
	note: AlertCircle,
	tip: Lightbulb,
	info: Info,
	warning: AlertTriangle,
	danger: AlertOctagon,
};

const TITLE_BY_VARIANT: Record<CalloutVariant, string> = {
	note: "NOTE",
	tip: "TIP",
	info: "INFO",
	warning: "WARNING",
	danger: "DANGER",
};

/**
 * 편집기 콜아웃 상자의 모양. 색은 종류(`data-variant`)별 강조색을 테마 배경·테두리에 섞어 만든다(이 패키지 `styles.css`의
 * `.cms-callout`, 강조색 변수 `--cms-callout-<종류>`). 공개 화면의 콜아웃은 사이트가 그린다.
 */
export const CALLOUT_BOX_CLASS = [
	"cms-callout relative block w-full rounded-lg border px-4 py-3 text-sm",
	"[&>svg]:size-4 [&>svg]:translate-y-0.5",
].join(" ");

/** 제목을 비웠을 때 편집기에 흐리게 보이는 기본 제목. */
export const getDefaultCalloutTitle = (variant: CalloutVariant) => TITLE_BY_VARIANT[variant];
