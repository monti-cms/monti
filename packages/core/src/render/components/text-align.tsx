import type { ReactNode } from "react";
import { TEXT_ALIGN_VALUES } from "../../mdx";

type Align = (typeof TEXT_ALIGN_VALUES)[number];

const isAlign = (value: string | undefined): value is Align => TEXT_ALIGN_VALUES.some((allowed) => allowed === value);

/**
 * `:::text-align{align}` 컨테이너. 검증된 값만 고정 클래스로 바꾼다(값을 className·style에 그대로 넣지 않는다, A4).
 * 허용하지 않는 값은 기본 정렬이다.
 */
export function CmsTextAlign({ align, children }: { align?: string; children?: ReactNode }) {
	return <div className={isAlign(align) ? `cms-align-${align}` : undefined}>{children}</div>;
}
