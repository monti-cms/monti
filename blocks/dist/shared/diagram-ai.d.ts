import type { AiValidator } from "@monti-cms/core/ai-contract";
import type { Site } from "@monti-cms/core/site";
/** What the actions read from the site: its admin-language translator (the actions are created per site). */
export type AiTextSite = Pick<Site, "createTranslator">;
/** The texts every diagram-like block (chart, Mermaid) writes for its AI actions, in the dictionary of the block. */
export type DiagramAiKey = "ai.draft.label" | "ai.edit.label" | "ai.input.title" | "ai.input.body" | "ai.input.block" | "ai.check.label" | "ai.draft.prompt" | "ai.edit.prompt";
export type DiagramAiText = (key: DiagramAiKey, values?: Record<string, string | number>) => string;
export interface DiagramAiSpec {
    /** The block the actions edit (`chart`, `mermaid`): the fence name and the attach target. */
    readonly block: string;
    /** The name of the result check. */
    readonly syntaxName: string;
    /** The block's dictionary, read with the site's admin language. */
    readonly text: (site: AiTextSite) => DiagramAiText;
    /** Is the answer a single code fence of this block with valid contents? An error text, or `undefined`. */
    readonly validate: (site: AiTextSite, value: string) => string | undefined;
    /** Extra material written after the instructions (a syntax guide). */
    readonly guide?: (site: AiTextSite) => string;
    /** The answer of the development-only fake connection. */
    readonly fake: (site: AiTextSite) => (input: Readonly<Record<string, string>>) => string;
}
/**
 * The AI actions of a block that is a code fence with a small language (chart, Mermaid): create one from the slash menu, and edit one from beside the block handle. Both
 * take the block's own texts, check that the answer is a single fence of the block that parses, and attach where the block lives.
 */
export declare function diagramAi(spec: DiagramAiSpec): {
    syntax: (site: AiTextSite) => AiValidator;
    /** Create. Takes a request from the slash menu and inserts the block at the cursor. */
    draft: (options?: {
        readonly prompt?: string;
    }) => (site: AiTextSite) => {
        readonly label: string;
        readonly input: {
            readonly title: {
                readonly kind: "text";
                readonly label: string;
            };
            readonly body: {
                readonly kind: "mdx";
                readonly label: string;
            };
        };
        readonly result: "mdx";
        readonly stream: true;
        readonly askInstruction: true;
        readonly prompt: string;
        readonly checks: readonly [AiValidator];
        readonly fake: (input: Readonly<Record<string, string>>) => string;
        readonly attach: readonly [{
            readonly slot: "insert";
        }];
    };
    /** Edit. Edits as requested from beside the block handle, shows what changed, then replaces the block. */
    edit: (options?: {
        readonly prompt?: string;
    }) => (site: AiTextSite) => {
        readonly label: string;
        readonly input: {
            readonly block: {
                readonly kind: "mdx";
                readonly label: string;
                readonly required: true;
            };
            readonly title: {
                readonly kind: "text";
                readonly label: string;
            };
        };
        readonly result: "mdx";
        readonly stream: true;
        readonly askInstruction: true;
        readonly prompt: string;
        readonly checks: readonly [AiValidator];
        readonly fake: (input: Readonly<Record<string, string>>) => string;
        readonly attach: readonly [{
            readonly slot: "block";
            readonly block: string;
        }];
    };
};
