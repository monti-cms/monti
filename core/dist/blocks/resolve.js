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
/** The block list for the config. Throws an error for an invalid config. */
export function resolveBlocks(sources) {
    const added = addedBlocks(sources);
    const taken = new Set([
        ...BUILTIN_BLOCKS.map((block) => block.name),
        ...BUILTIN_BLOCKS.map((block) => block.component),
    ]);
    const directives = new Set(BUILTIN_BLOCKS.flatMap((block) => ("directive" in block.syntax ? [block.syntax.directive] : [])));
    const langs = new Set();
    for (const { where, block } of added) {
        const at = `cms.config: ${where}`;
        if (!NAME.test(block.name))
            throw new Error(`${at}: name must be lower-case kebab`);
        const { syntax } = block;
        if (syntax.kind === "fence") {
            if (!NAME.test(syntax.lang))
                throw new Error(`${at}: fence lang must be lower-case kebab`);
            if (langs.has(syntax.lang))
                throw new Error(`${at}: fence lang "${syntax.lang}" is already used`);
            langs.add(syntax.lang);
        }
        else if (syntax.kind === "container" || syntax.kind === "leaf" || syntax.kind === "text") {
            if (syntax.directive !== block.name)
                throw new Error(`${at}: directive must equal the block name`);
            if (directives.has(syntax.directive))
                throw new Error(`${at}: name or component is already used`);
            directives.add(syntax.directive);
        }
        else {
            throw new Error(`${at}: only container, leaf, text or fence blocks can be added`);
        }
        if (!COMPONENT.test(block.component))
            throw new Error(`${at}: component must be PascalCase`);
        if (taken.has(block.name) || taken.has(block.component)) {
            throw new Error(`${at}: name or component is already used`);
        }
        if (syntax.kind === "text") {
            if (block.editor.view !== "mark")
                throw new Error(`${at}: a text block needs editor.view "mark"`);
            if (block.children || block.parent)
                throw new Error(`${at}: a text block has no children or parent`);
        }
        else if (block.editor.view !== "node" && block.editor.view !== "opaque") {
            throw new Error(`${at}: editor.view must be "node" or "opaque"`);
        }
        const anchors = Object.entries(block.attributes).filter(([, attribute]) => attribute.codeAnchor);
        if (anchors.length > 0 && (syntax.kind !== "text" || anchors.length > 1 || anchors[0]?.[1].type !== "string")) {
            throw new Error(`${at}: codeAnchor needs one string attribute of a text block`);
        }
        taken.add(block.name);
        taken.add(block.component);
    }
    const extra = added.map(({ block }) => block);
    const anchorBlocks = extra.filter((block) => Object.values(block.attributes).some((attribute) => attribute.codeAnchor));
    if (anchorBlocks.length > 1) {
        throw new Error(`cms.config: only one block can link code lines (codeAnchor): ${anchorBlocks.map((b) => b.name).join(", ")}`);
    }
    const names = new Set(extra.map((block) => block.name));
    for (const { where, block } of added) {
        if (block.parent && !names.has(block.parent)) {
            throw new Error(`cms.config: ${where}: parent "${block.parent}" is not an added block`);
        }
        for (const child of block.children?.blocks ?? []) {
            // A child of an added block is an added block too (the editor nodes are built the same way).
            if (!extra.some((candidate) => candidate.name === child && candidate.parent === block.name)) {
                throw new Error(`cms.config: ${where}: child "${child}" must be an added block with this parent`);
            }
        }
        for (const [name, attribute] of Object.entries(block.attributes)) {
            if (!attribute.childValue)
                continue;
            const children = (block.children?.blocks ?? []).map((child) => extra.find((c) => c.name === child));
            if (!children.some((child) => child && Object.hasOwn(child.attributes, attribute.childValue ?? ""))) {
                throw new Error(`cms.config: ${where}.attributes.${name}: no child block has "${attribute.childValue}"`);
            }
        }
    }
    return [...BUILTIN_BLOCKS, ...extra];
}
