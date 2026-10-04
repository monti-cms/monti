"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { formatCrop, isFullCrop, parseCrop, parseRotate, roundCropBox, } from "@monti-cms/core/mdx";
import { RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button.js";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import { editorMessages } from "./messages.js";
const t = createTranslator(editorMessages);
const round2 = (n) => Math.round(n * 100) / 100;
const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
export function ImageCropDialog({ open, onOpenChange, src, crop, rotate, onApply }) {
    const containerRef = useRef(null);
    const imgRef = useRef(null);
    const activeDragCleanupRef = useRef(null);
    const [cropDraft, setCropDraft] = useState({ x: 0, y: 0, width: 100, height: 100 });
    const [rotateDraft, setRotateDraft] = useState(0);
    useEffect(() => {
        return () => {
            activeDragCleanupRef.current?.();
        };
    }, []);
    useEffect(() => {
        // Do not leave global pointer listeners behind if the dialog closes mid-drag.
        if (!open) {
            activeDragCleanupRef.current?.();
            return;
        }
        const parsedCrop = parseCrop(crop);
        setCropDraft(parsedCrop || { x: 0, y: 0, width: 100, height: 100 });
        const parsedRot = parseRotate(rotate);
        setRotateDraft(parsedRot || 0);
    }, [open, crop, rotate]);
    const handleRotate90 = () => {
        setRotateDraft((prev) => ((prev + 90) % 360));
    };
    const handleResetRotate = () => {
        setRotateDraft(0);
    };
    const handleResetCrop = () => {
        setCropDraft({ x: 0, y: 0, width: 100, height: 100 });
    };
    const handleResetAll = () => {
        handleResetCrop();
        handleResetRotate();
    };
    const handleApply = (event) => {
        event?.preventDefault();
        const finalCrop = isFullCrop(cropDraft) ? null : formatCrop(cropDraft);
        const finalRotate = rotateDraft === 0 ? null : String(rotateDraft);
        onApply({ crop: finalCrop, rotate: finalRotate });
        onOpenChange(false);
    };
    // Alternative: typing values directly with the keyboard
    const handleNumericCropChange = (field, rawValue) => {
        if (!Number.isFinite(rawValue))
            return;
        const val = round2(rawValue);
        setCropDraft((prev) => {
            let { x, y, width, height } = prev;
            if (field === "x") {
                x = clamp(val, 0, 99);
                if (x + width > 100)
                    width = round2(100 - x);
            }
            else if (field === "y") {
                y = clamp(val, 0, 99);
                if (y + height > 100)
                    height = round2(100 - y);
            }
            else if (field === "width") {
                width = clamp(val, 1, round2(100 - x));
            }
            else if (field === "height") {
                height = clamp(val, 1, round2(100 - y));
            }
            return { x, y, width, height };
        });
    };
    // Select the crop area by dragging (free aspect ratio, coordinates relative to the real image element)
    const handlePointerDown = (e, handle) => {
        e.preventDefault();
        e.stopPropagation();
        const targetElement = imgRef.current ?? containerRef.current;
        if (!targetElement)
            return;
        const rect = targetElement.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0)
            return;
        activeDragCleanupRef.current?.();
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startXPercent = clamp(((startClientX - rect.left) / rect.width) * 100, 0, 100);
        const startYPercent = clamp(((startClientY - rect.top) / rect.height) * 100, 0, 100);
        const initialCrop = { ...cropDraft };
        const onPointerMove = (moveEvent) => {
            const currentXPercent = clamp(((moveEvent.clientX - rect.left) / rect.width) * 100, 0, 100);
            const currentYPercent = clamp(((moveEvent.clientY - rect.top) / rect.height) * 100, 0, 100);
            const deltaX = currentXPercent - startXPercent;
            const deltaY = currentYPercent - startYPercent;
            if (!handle) {
                // Clicking outside the area starts a new rectangle by dragging
                const x = Math.min(startXPercent, currentXPercent);
                const y = Math.min(startYPercent, currentYPercent);
                const width = Math.abs(currentXPercent - startXPercent);
                const height = Math.abs(currentYPercent - startYPercent);
                if (width >= 2 && height >= 2) {
                    setCropDraft(roundCropBox({ x, y, width, height }));
                }
                return;
            }
            if (handle === "move") {
                const newX = clamp(initialCrop.x + deltaX, 0, 100 - initialCrop.width);
                const newY = clamp(initialCrop.y + deltaY, 0, 100 - initialCrop.height);
                setCropDraft(roundCropBox({ ...initialCrop, x: newX, y: newY }));
                return;
            }
            if (handle === "se") {
                const newWidth = clamp(initialCrop.width + deltaX, 2, 100 - initialCrop.x);
                const newHeight = clamp(initialCrop.height + deltaY, 2, 100 - initialCrop.y);
                setCropDraft(roundCropBox({ ...initialCrop, width: newWidth, height: newHeight }));
            }
            else if (handle === "sw") {
                const maxLeft = initialCrop.x + initialCrop.width - 2;
                const newX = clamp(initialCrop.x + deltaX, 0, maxLeft);
                const newWidth = initialCrop.x + initialCrop.width - newX;
                const newHeight = clamp(initialCrop.height + deltaY, 2, 100 - initialCrop.y);
                setCropDraft(roundCropBox({ x: newX, y: initialCrop.y, width: newWidth, height: newHeight }));
            }
            else if (handle === "ne") {
                const newWidth = clamp(initialCrop.width + deltaX, 2, 100 - initialCrop.x);
                const maxTop = initialCrop.y + initialCrop.height - 2;
                const newY = clamp(initialCrop.y + deltaY, 0, maxTop);
                const newHeight = initialCrop.y + initialCrop.height - newY;
                setCropDraft(roundCropBox({ x: initialCrop.x, y: newY, width: newWidth, height: newHeight }));
            }
            else if (handle === "nw") {
                const maxLeft = initialCrop.x + initialCrop.width - 2;
                const maxTop = initialCrop.y + initialCrop.height - 2;
                const newX = clamp(initialCrop.x + deltaX, 0, maxLeft);
                const newY = clamp(initialCrop.y + deltaY, 0, maxTop);
                const newWidth = initialCrop.x + initialCrop.width - newX;
                const newHeight = initialCrop.y + initialCrop.height - newY;
                setCropDraft(roundCropBox({ x: newX, y: newY, width: newWidth, height: newHeight }));
            }
        };
        const cleanup = () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerCancel);
            activeDragCleanupRef.current = null;
        };
        const onPointerUp = () => {
            cleanup();
        };
        const onPointerCancel = () => {
            cleanup();
        };
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerCancel);
        activeDragCleanupRef.current = cleanup;
    };
    const isFull = isFullCrop(cropDraft);
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsx(DialogContent, { className: "max-w-2xl gap-4 p-5 sm:max-w-xl", children: _jsxs("form", { onSubmit: handleApply, className: "contents", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: t("imageCrop.title") }) }), _jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx("div", { className: "flex max-h-[380px] w-full items-center justify-center overflow-hidden rounded-md border bg-cms-muted/30 p-1", children: _jsxs("div", { ref: containerRef, onPointerDown: (e) => handlePointerDown(e), className: "relative inline-block select-none", style: { touchAction: "none" }, children: [_jsx("img", { ref: imgRef, src: src, alt: t("imageCrop.target"), className: "pointer-events-none block max-h-[360px] max-w-full select-none rounded", draggable: false }), !isFull && (_jsxs(_Fragment, { children: [_jsx("div", { className: "pointer-events-none absolute inset-0 bg-cms-foreground/40", style: {
                                                        clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${cropDraft.x}% ${cropDraft.y}%, ${cropDraft.x}% ${cropDraft.y + cropDraft.height}%, ${cropDraft.x + cropDraft.width}% ${cropDraft.y + cropDraft.height}%, ${cropDraft.x + cropDraft.width}% ${cropDraft.y}%, ${cropDraft.x}% ${cropDraft.y}%)`,
                                                    } }), _jsxs("div", { "data-slot": "crop-box", onPointerDown: (e) => handlePointerDown(e, "move"), className: "absolute cursor-move border-2 border-cms-primary shadow-sm", style: {
                                                        left: `${cropDraft.x}%`,
                                                        top: `${cropDraft.y}%`,
                                                        width: `${cropDraft.width}%`,
                                                        height: `${cropDraft.height}%`,
                                                    }, children: [_jsx("button", { type: "button", "data-slot": "crop-handle-nw", onPointerDown: (e) => handlePointerDown(e, "nw"), className: "absolute -top-1.5 -left-1.5 size-3.5 cursor-nwse-resize rounded-sm border border-cms-background bg-cms-primary p-0 shadow-sm", "aria-label": t("imageCrop.handleNw") }), _jsx("button", { type: "button", "data-slot": "crop-handle-ne", onPointerDown: (e) => handlePointerDown(e, "ne"), className: "absolute -top-1.5 -right-1.5 size-3.5 cursor-nesw-resize rounded-sm border border-cms-background bg-cms-primary p-0 shadow-sm", "aria-label": t("imageCrop.handleNe") }), _jsx("button", { type: "button", "data-slot": "crop-handle-sw", onPointerDown: (e) => handlePointerDown(e, "sw"), className: "absolute -bottom-1.5 -left-1.5 size-3.5 cursor-nesw-resize rounded-sm border border-cms-background bg-cms-primary p-0 shadow-sm", "aria-label": t("imageCrop.handleSw") }), _jsx("button", { type: "button", "data-slot": "crop-handle-se", onPointerDown: (e) => handlePointerDown(e, "se"), className: "absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize rounded-sm border border-cms-background bg-cms-primary p-0 shadow-sm", "aria-label": t("imageCrop.handleSe") })] })] }))] }) }), _jsx("div", { className: "flex w-full flex-wrap items-center justify-between gap-2 text-cms-muted-foreground text-xs", children: _jsx("span", { children: isFull
                                        ? t("imageCrop.full")
                                        : t("imageCrop.region", {
                                            width: cropDraft.width,
                                            height: cropDraft.height,
                                            x: cropDraft.x,
                                            y: cropDraft.y,
                                        }) }) }), _jsxs("div", { className: "flex w-full items-center justify-between gap-2 rounded-lg border bg-cms-muted/10 p-2 text-xs", children: [_jsx("span", { className: "font-medium text-cms-muted-foreground", children: t("imageCrop.regionPercent") }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Label, { htmlFor: "crop-input-x", className: "text-cms-muted-foreground text-xs", children: "X" }), _jsx(Input, { id: "crop-input-x", type: "number", min: 0, max: 99, step: 1, value: cropDraft.x, "aria-label": t("imageCrop.x"), onChange: (e) => handleNumericCropChange("x", Number(e.target.value)), className: "h-6 w-14 px-1.5 text-center text-xs" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Label, { htmlFor: "crop-input-y", className: "text-cms-muted-foreground text-xs", children: "Y" }), _jsx(Input, { id: "crop-input-y", type: "number", min: 0, max: 99, step: 1, value: cropDraft.y, "aria-label": t("imageCrop.y"), onChange: (e) => handleNumericCropChange("y", Number(e.target.value)), className: "h-6 w-14 px-1.5 text-center text-xs" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Label, { htmlFor: "crop-input-w", className: "text-cms-muted-foreground text-xs", children: "W" }), _jsx(Input, { id: "crop-input-w", type: "number", min: 1, max: 100, step: 1, value: cropDraft.width, "aria-label": t("imageCrop.width"), onChange: (e) => handleNumericCropChange("width", Number(e.target.value)), className: "h-6 w-14 px-1.5 text-center text-xs" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Label, { htmlFor: "crop-input-h", className: "text-cms-muted-foreground text-xs", children: "H" }), _jsx(Input, { id: "crop-input-h", type: "number", min: 1, max: 100, step: 1, value: cropDraft.height, "aria-label": t("imageCrop.height"), onChange: (e) => handleNumericCropChange("height", Number(e.target.value)), className: "h-6 w-14 px-1.5 text-center text-xs" })] })] })] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-lg border bg-cms-muted/20 p-2.5", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx("span", { className: "font-medium", children: t("imageCrop.rotate") }), _jsxs("span", { className: "font-semibold text-cms-primary", children: [rotateDraft, "\u00B0"] })] }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: handleRotate90, children: [_jsx(RotateCw, { "aria-hidden": true }), t("imageCrop.rotate90")] })] }), _jsxs(DialogFooter, { className: "flex items-center justify-between gap-2 sm:justify-between", children: [_jsx(Button, { type: "button", variant: "ghost", disabled: isFull && rotateDraft === 0, onClick: handleResetAll, children: t("imageCrop.reset") }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: t("imageCrop.cancel") }), _jsx(Button, { type: "submit", children: t("imageCrop.apply") })] })] })] }) }) }));
}
