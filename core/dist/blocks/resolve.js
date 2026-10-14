import { CONFIG_SOURCE, IssueList, pathOf, throwIssues } from "../config/check/issue.js";
import { RESERVED_BLOCK_ATTRIBUTES } from "./define.js";
import { BUILTIN_BLOCKS } from "./definitions.js";
const NAME = /^[a-z][a-z0-9-]*$/;
const COMPONENT = /^[A-Z][A-Za-z0-9]*$/;
/** Added blocks (in plugin order, then the site config). */
export function addedBlocks(sources) {
    return [
        ...(sources?.plugins ?? []).flatMap((plugin) => (plugin.blocks ?? []).map((block) => ({ where: `plugins.${plugin.name}.blocks.${block.name}`, block }))),
        ...(sources?.blocks ?? []).map((block) => ({ where: `blocks.${block.name}`, block })),
    ];
}
/** The block list for the config, and what is wrong with the blocks that were added. Blocks with problems are still listed, so the other checks can go on. */
export function resolveBlocksChecked(sources) {
    const list = new IssueList();
    const added = addedBlocks(sources);
    const taken = new Set([
        ...BUILTIN_BLOCKS.map((block) => block.name),
        ...BUILTIN_BLOCKS.map((block) => block.component),
    ]);
    const directives = new Set(BUILTIN_BLOCKS.flatMap((block) => ("directive" in block.syntax ? [block.syntax.directive] : [])));
    const langs = new Set();
    for (const { where, block } of added) {
        if (!NAME.test(block.name))
            list.add(where, "name", "name must be lower-case kebab");
        const { syntax } = block;
        if (syntax.kind === "fence") {
            if (!NAME.test(syntax.lang))
                list.add(where, "fence-lang", "fence lang must be lower-case kebab");
            if (langs.has(syntax.lang))
                list.add(where, "fence-lang", `fence lang "${syntax.lang}" is already used`);
            langs.add(syntax.lang);
        }
        else if (syntax.kind === "container" || syntax.kind === "leaf" || syntax.kind === "text") {
            if (syntax.directive !== block.name)
                list.add(where, "directive", "directive must equal the block name");
            if (directives.has(syntax.directive))
                list.add(where, "taken", "name or component is already used");
            directives.add(syntax.directive);
        }
        else {
            list.add(where, "syntax", "only container, leaf, text or fence blocks can be added");
        }
        if (!COMPONENT.test(block.component))
            list.add(where, "component", "component must be PascalCase");
        if (taken.has(block.name) || taken.has(block.component)) {
            list.add(where, "taken", "name or component is already used");
        }
        if (syntax.kind === "text") {
            if (block.editor.view !== "mark")
                list.add(where, "editor-view", 'a text block needs editor.view "mark"');
            if (block.children || block.parent)
                list.add(where, "text-block", "a text block has no children or parent");
        }
        else if (block.editor.view !== "node" && block.editor.view !== "opaque") {
            list.add(where, "editor-view", 'editor.view must be "node" or "opaque"');
        }
        const reserved = Object.keys(block.attributes).find((name) => RESERVED_BLOCK_ATTRIBUTES.includes(name));
        if (reserved) {
            list.add(pathOf(where, "attributes", reserved), "reserved-attribute", `is reserved (${RESERVED_BLOCK_ATTRIBUTES.join(", ")}): the public renderer passes it to the component itself`);
        }
        const anchors = Object.entries(block.attributes).filter(([, attribute]) => attribute.codeAnchor);
        if (anchors.length > 0 && (syntax.kind !== "text" || anchors.length > 1 || anchors[0]?.[1].type !== "string")) {
            list.add(where, "code-anchor", "codeAnchor needs one string attribute of a text block");
        }
        taken.add(block.name);
        taken.add(block.component);
    }
    const extra = added.map(({ block }) => block);
    const anchorBlocks = extra.filter((block) => Object.values(block.attributes).some((attribute) => attribute.codeAnchor));
    if (anchorBlocks.length > 1) {
        list.add("blocks", "code-anchor", `only one block can link code lines (codeAnchor): ${anchorBlocks.map((b) => b.name).join(", ")}`);
    }
    const names = new Set(extra.map((block) => block.name));
    for (const { where, block } of added) {
        if (block.parent && !names.has(block.parent)) {
            list.add(pathOf(where, "parent"), "parent", `"${block.parent}" is not an added block`);
        }
        for (const child of block.children?.blocks ?? []) {
            // A child of an added block is an added block too (the editor nodes are built the same way).
            if (!extra.some((candidate) => candidate.name === child && candidate.parent === block.name)) {
                list.add(pathOf(where, "children"), "child", `"${child}" must be an added block with this parent`);
            }
        }
        for (const [name, attribute] of Object.entries(block.attributes)) {
            if (!attribute.childValue)
                continue;
            const children = (block.children?.blocks ?? []).map((child) => extra.find((c) => c.name === child));
            if (!children.some((child) => child && Object.hasOwn(child.attributes, attribute.childValue ?? ""))) {
                list.add(pathOf(where, "attributes", name), "child-value", `no child block has "${attribute.childValue}"`);
            }
        }
    }
    return { blocks: [...BUILTIN_BLOCKS, ...extra], issues: list.issues };
}
/** The block list for the config. Throws a {@link ConfigError} for an invalid config. */
export function resolveBlocks(sources) {
    const { blocks, issues } = resolveBlocksChecked(sources);
    throwIssues(CONFIG_SOURCE, issues);
    return blocks;
}
