import type { PropsWithChildren } from "react";
import { type BlockLabels, blockLabels } from "../shared/labels";

/** 접기. 제목을 눌러 펼친다(`<details>`라 스크립트 없이 된다). 제목이 없으면 사이트 언어의 기본 문구다. */
export function Collapsible({
	title,
	defaultOpen,
	labels = blockLabels(),
	children,
}: PropsWithChildren<{ title?: string; defaultOpen?: boolean; labels?: BlockLabels }>) {
	return (
		<details className="cms-block-collapsible" open={defaultOpen || undefined}>
			<summary className="cms-block-collapsible-summary">{title?.trim() || labels.collapsibleFallback}</summary>
			<div className="cms-block-collapsible-body">{children}</div>
		</details>
	);
}

type ComponentProps = Parameters<typeof Collapsible>[0];

/** 접기의 공개 컴포넌트(`@monti-cms/core/render`가 부른다). */
export default ({ locale }: { locale?: string }) => {
	const labels = blockLabels(locale);
	return { Collapsible: (props: ComponentProps) => <Collapsible {...props} labels={labels} /> };
};
