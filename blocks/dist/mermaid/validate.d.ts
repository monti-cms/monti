import type { BlockValidate } from "@monti-cms/core";
/**
 * Checks the source of a Mermaid diagram with Mermaid's own parser (`mermaid.parse`, which needs no DOM, so it runs in the server write pipeline).
 * Nothing is reported when `mermaid` is not installed, or when the parser itself fails for a reason that is not the diagram (a `TypeError` or
 * `ReferenceError` from a runtime without what a diagram type needs): a check that cannot run must not warn about a good diagram.
 */
export declare const validateMermaidBlock: BlockValidate;
