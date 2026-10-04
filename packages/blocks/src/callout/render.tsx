import type { PropsWithChildren } from "react";
import { type BlockLabels, blockLabels } from "../shared/labels";
import type { CalloutVariant } from "./style";

const VARIANTS: readonly CalloutVariant[] = ["note", "tip", "info", "warning", "danger"];

const titleOf = (variant: CalloutVariant, labels: BlockLabels) =>
	({
		note: labels.calloutNote,
		tip: labels.calloutTip,
		info: labels.calloutInfo,
		warning: labels.calloutWarning,
		danger: labels.calloutDanger,
	})[variant];

/** 콜아웃. 종류(`variant`)별 강조색으로 제목과 본문을 상자에 담는다. 모르는 종류는 노트, 제목이 없으면 종류 이름이다. */
export function Callout({
	variant,
	title,
	labels = blockLabels(),
	children,
}: PropsWithChildren<{ variant?: string; title?: string; labels?: BlockLabels }>) {
	const kind = VARIANTS.find((item) => item === variant) ?? "note";
	return (
		<div className="cms-block-callout" data-variant={kind} role="note">
			<div className="cms-block-callout-title">{title?.trim() || titleOf(kind, labels)}</div>
			{/* 본문 없이 제목만 둔 콜아웃은 빈 본문 칸을 그리지 않는다. */}
			{children ? <div className="cms-block-callout-body">{children}</div> : null}
		</div>
	);
}

type CalloutProps = Parameters<typeof Callout>[0];

/** 콜아웃의 공개 컴포넌트(`@monti-cms/core/render`가 부른다). */
export default ({ locale }: { locale?: string }) => {
	const labels = blockLabels(locale);
	return { Callout: (props: CalloutProps) => <Callout {...props} labels={labels} /> };
};
