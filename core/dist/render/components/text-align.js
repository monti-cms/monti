import { jsx as _jsx } from "react/jsx-runtime";
import { TEXT_ALIGN_VALUES } from "../../blocks/derive.js";
const isAlign = (value) => TEXT_ALIGN_VALUES.some((allowed) => allowed === value);
/**
 * `:::text-align{align}` container. Only validated values are turned into fixed classes (values are not put into className or style as they are).
 * Disallowed values fall back to the default alignment.
 */
export function CmsTextAlign({ align, children }) {
    return _jsx("div", { className: isAlign(align) ? `cms-align-${align}` : undefined, children: children });
}
