"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils/cn.js";
import { getShikiHighlighter } from "./code-block/highlight-plugin.js";
/** A token colored per line. The color uses the light theme value and switches to `--shiki-dark` in the dark theme. */
async function highlightMdx(source) {
    const highlighter = await getShikiHighlighter();
    const lines = highlighter.codeToTokensWithThemes(source, {
        lang: "mdx",
        themes: { light: "one-light", dark: "one-dark-pro" },
    });
    return lines.map((line) => ({
        text: line.map((token) => token.content).join(""),
        tokens: line.map((token) => ({
            content: token.content,
            light: token.variants?.light?.color,
            dark: token.variants?.dark?.color,
        })),
    }));
}
const styleOf = (token) => token.light || token.dark ? { color: token.light, "--shiki-dark": token.dark } : undefined;
/**
 * MDX source edit field. Text is written into an invisible input, and an overlaid layer in the same spot shows MDX syntax colors.
 * Colors are re-applied after typing pauses briefly. Until then only the changed line shows without color (so the text does not look misaligned).
 */
export function MdxSourceEditor({ value, className, ...props }) {
    const [highlighted, setHighlighted] = useState([]);
    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(() => {
            highlightMdx(value)
                .then((lines) => {
                if (!cancelled)
                    setHighlighted(lines);
            })
                .catch(() => {
                if (!cancelled)
                    setHighlighted([]);
            });
        }, 120);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [value]);
    const lines = useMemo(() => value.split("\n"), [value]);
    return (_jsxs("div", { className: cn("grid font-mono text-sm leading-6", className), children: [_jsx("pre", { "aria-hidden": true, className: "pointer-events-none col-start-1 row-start-1 m-0 min-w-0 whitespace-pre-wrap break-words bg-transparent p-0 font-[inherit] text-cms-foreground cms-dark:[&_span[style]]:text-(--shiki-dark)!", children: lines.map((line, index) => {
                    const cached = highlighted[index];
                    return (_jsxs("span", { children: [cached && cached.text === line
                                ? cached.tokens.map((token, tokenIndex) => (_jsx("span", { style: styleOf(token), children: token.content }, tokenIndex)))
                                : line, index < lines.length - 1 ? "\n" : "​"] }, index));
                }) }), _jsx("textarea", { ...props, value: value, spellCheck: false, className: "col-start-1 row-start-1 m-0 min-h-0 w-full resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent p-0 font-[inherit] text-transparent caret-cms-foreground outline-none selection:bg-cms-primary/20 selection:text-transparent placeholder:text-cms-muted-foreground" })] }));
}
