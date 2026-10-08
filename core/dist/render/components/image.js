import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { resolveImageUrl } from "../../doc/image-src.js";
import { CmsImageView } from "./image-view.js";
/** `width` accepts only 1 to 100% or 1 to 4096px. Other values are ignored. */
export const validImageWidth = (value) => {
    if (!value)
        return undefined;
    const percent = /^(\d{1,3}(?:\.\d+)?)%$/.exec(value);
    if (percent && Number(percent[1]) > 0 && Number(percent[1]) <= 100)
        return value;
    const pixels = /^(\d+)px$/.exec(value);
    if (pixels && Number(pixels[1]) > 0 && Number(pixels[1]) <= 4096)
        return value;
    return undefined;
};
const ALIGNS = new Set(["left", "center", "right"]);
/**
 * `::image{...}`. The address is decided by the resolver (`resolve`) passed by the caller (only the outer `src` if there is none), and this component does not read the DB.
 * If it cannot be resolved, only an empty slot and the caption remain, and `width` and `align` are not used. The failure reason is not shown and it is not replaced with `alt`.
 */
export function CmsImage({ mediaId, src, alt, width, align, caption, decorative, crop, title, rotate, resolve, unavailableLabel = "Image unavailable", }) {
    const resolved = resolve ? resolve({ mediaId, src }) : resolveImageUrl(src);
    const ok = resolved && "url" in resolved ? resolved : null;
    const captionText = caption?.trim();
    const alignName = align && ALIGNS.has(align) ? align : "center";
    if (decorative && !ok)
        return captionText ? _jsx("p", { className: "cms-image-caption", children: captionText }) : null;
    if (!ok) {
        return (_jsxs("figure", { className: "cms-image cms-image-align-center", children: [_jsx("div", { role: "img", "aria-label": unavailableLabel, className: "cms-image-unavailable", children: unavailableLabel }), captionText ? _jsx("figcaption", { className: "cms-image-caption", children: captionText }) : null] }));
    }
    return (_jsxs("figure", { className: `cms-image cms-image-align-${alignName}`, children: [_jsx(CmsImageView, { src: ok.url, alt: alt ?? "", decorative: decorative, style: validImageWidth(width) ? { width: validImageWidth(width) } : undefined, crop: crop, rotate: rotate, title: title, intrinsicSize: ok.width && ok.height ? { width: ok.width, height: ok.height } : undefined, unavailableLabel: unavailableLabel }), captionText ? _jsx("figcaption", { className: "cms-image-caption", children: captionText }) : null] }));
}
