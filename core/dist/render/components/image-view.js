"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from "react";
import { computeImageTransform, intrinsicDisplayWidth } from "../../mdx/image-transform.js";
/**
 * Body image (browser). Crop and rotate need the original aspect ratio, so they are fitted in the browser. The slot is reserved first with the original size the server knows.
 * If it cannot be read, an empty slot and `unavailableLabel` are shown.
 */
export function CmsImageView({ src, alt, decorative, style, crop, rotate, title, intrinsicSize, unavailableLabel, }) {
    const [failed, setFailed] = useState(false);
    const [natural, setNatural] = useState(intrinsicSize ?? null);
    const readNaturalSize = (image) => {
        const { naturalWidth, naturalHeight } = image;
        if (naturalWidth <= 0 || naturalHeight <= 0)
            return;
        setNatural((current) => current?.width === naturalWidth && current.height === naturalHeight
            ? current
            : { width: naturalWidth, height: naturalHeight });
    };
    const transform = computeImageTransform({
        crop,
        rotate,
        aspectRatio: natural ? natural.width / natural.height : null,
    });
    if (failed) {
        return (_jsx("div", { role: "img", "aria-label": decorative ? undefined : unavailableLabel, className: "cms-image-unavailable", children: decorative ? null : unavailableLabel }));
    }
    if (transform.isTransformed) {
        const intrinsic = intrinsicDisplayWidth(transform, natural);
        return (_jsx("div", { className: "cms-image-transform", style: {
                ...style,
                width: style?.width ?? (intrinsic ? `${intrinsic}px` : "100%"),
                maxWidth: "100%",
                ...transform.wrapperStyle,
            }, children: _jsx("img", { alt: decorative ? "" : alt, loading: "lazy", onError: () => setFailed(true), onLoad: (event) => readNaturalSize(event.currentTarget), ref: (image) => {
                    if (image?.complete)
                        readNaturalSize(image);
                }, src: src, style: transform.imageStyle, title: title }) }));
    }
    return (_jsx("img", { alt: decorative ? "" : alt, className: "cms-image-plain", height: intrinsicSize?.height, loading: "lazy", onError: () => setFailed(true), src: src, style: style, title: title, width: intrinsicSize?.width }));
}
