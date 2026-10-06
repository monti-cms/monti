import type { ReactNode } from "react";
import { TEXT_ALIGN_VALUES } from "../../blocks/derive";

type Align = (typeof TEXT_ALIGN_VALUES)[number];

const isAlign = (value: string | undefined): value is Align => TEXT_ALIGN_VALUES.some((allowed) => allowed === value);

/**
 * `:::text-align{align}` container. Only validated values are turned into fixed classes (values are not put into className or style as they are).
 * Disallowed values fall back to the default alignment.
 */
export function CmsTextAlign({ align, children }: { align?: string; children?: ReactNode }) {
	return <div className={isAlign(align) ? `cms-align-${align}` : undefined}>{children}</div>;
}
