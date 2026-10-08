import { mermaidMessages } from "./messages.js";
let parser;
/** The Mermaid parser, loaded once. `null` when the optional dependency `mermaid` is not installed here. */
const loadParser = () => {
    parser ??= import("mermaid").then((module) => module.default, () => null);
    return parser;
};
/** First line of a parser error, with the indentation a Mermaid error keeps. The rest is a copy of the source with a marker. */
const firstLine = (error) => {
    const text = error instanceof Error ? error.message : String(error);
    return (text.split("\n").find((line) => line.trim()) ?? text).trim();
};
/**
 * Checks the source of a Mermaid diagram with Mermaid's own parser (`mermaid.parse`, which needs no DOM, so it runs in the server write pipeline).
 * Nothing is reported when `mermaid` is not installed, or when the parser itself fails for a reason that is not the diagram (a `TypeError` or
 * `ReferenceError` from a runtime without what a diagram type needs): a check that cannot run must not warn about a good diagram.
 */
export const validateMermaidBlock = async (node, { site }) => {
    const mermaid = await loadParser();
    if (!mermaid)
        return undefined;
    try {
        await mermaid.parse(node.source ?? "");
        return undefined;
    }
    catch (error) {
        if (error instanceof TypeError || error instanceof ReferenceError)
            return undefined;
        const message = firstLine(error);
        const line = /line (\d+)/i.exec(message)?.[1];
        return [
            {
                code: "mermaid_syntax",
                message: site.createTranslator(mermaidMessages)("error.syntax", { message }),
                params: { message, ...(line === undefined ? {} : { line: Number(line) }) },
            },
        ];
    }
};
