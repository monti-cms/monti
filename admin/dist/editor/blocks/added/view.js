"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { useCmsAdminComponents } from "../../../admin-components.js";
import { cn } from "../../../lib/utils/cn.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select.js";
import { Switch } from "../../../ui/switch.js";
import { FencePreviewNodeView, LazyFencePreview } from "../fence-preview/index.js";
import { blocksMessages } from "../messages.js";
import { AttributeInput, BlockSettings, BlockSettingsField, ContainerToolbar, SELECTED_RING, useContainerValues, useEditorEditable, } from "../shared.js";
import { addedBlockOfNode, isContainer } from "./shared.js";
const t = createTranslator(blocksMessages);
/** Default input for one attribute (inside the settings popover). A select if it has choices, a switch for booleans, a text input otherwise. */
function AttributeField({ name, definition, values, setValue, editable, }) {
    const attribute = definition.attributes[name];
    if (!attribute)
        return null;
    const value = values[name] ?? attribute.defaultValue ?? (attribute.type === "boolean" ? false : "");
    const id = `${definition.name}-${name}`;
    const description = attribute.description ? (_jsx("p", { className: "text-cms-muted-foreground text-xs", children: attribute.description })) : null;
    if (attribute.type === "boolean") {
        return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsxs("label", { htmlFor: id, className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-cms-muted-foreground", children: attribute.label }), _jsx(Switch, { id: id, size: "sm", checked: value === true, disabled: !editable, onCheckedChange: (checked) => setValue(name, checked) })] }), description] }));
    }
    if (attribute.options) {
        const options = Object.entries(attribute.options).map(([option, label]) => ({ value: option, label }));
        return (_jsxs(BlockSettingsField, { label: attribute.label, htmlFor: id, children: [_jsxs(Select, { value: String(value), items: options, disabled: !editable, onValueChange: (next) => next !== null && setValue(name, String(next)), children: [_jsx(SelectTrigger, { id: id, size: "sm", className: "h-7 w-full text-xs", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: options.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] }), description] }));
    }
    return (_jsxs(BlockSettingsField, { label: attribute.label, htmlFor: id, children: [_jsx(AttributeInput, { id: id, value: String(value), readOnly: !editable, onCommit: (next) => setValue(name, next), className: "h-7 w-full rounded-md border border-cms-input cms-dark:bg-cms-input/30 px-2 text-xs shadow-xs placeholder:text-cms-muted-foreground placeholder:opacity-100 focus-visible:border-cms-ring focus-visible:ring-3 focus-visible:ring-cms-ring/50" }), description] }));
}
/** Default look when no edit component is registered: the block name with the body below it. Attributes are edited in the toolbar's settings popover. */
function DefaultCustomBlockEditor({ definition, values, setValue, content, editable }) {
    const names = Object.keys(definition.attributes);
    return (_jsxs(_Fragment, { children: [editable && names.length > 0 && (_jsx(ContainerToolbar, { label: t("added.toolbar", { label: definition.label }), children: _jsx(BlockSettings, { children: names.map((name) => (_jsx(AttributeField, { name: name, definition: definition, values: values, setValue: setValue, editable: editable }, name))) }) })), _jsx("div", { contentEditable: false, className: cn("not-prose px-3 py-2 font-medium text-cms-muted-foreground text-xs", content && "border-b"), children: definition.label }), content && _jsx("div", { className: "px-3", children: content })] }));
}
/** Default NodeView of a directive block. If an edit component (`blockEditors[block name]`) is registered, it is used to render. */
export function CustomBlockNodeView(props) {
    const { node, selected, editor } = props;
    const definition = addedBlockOfNode(node.type.name);
    const [values, setValue] = useContainerValues(props);
    const editable = useEditorEditable(editor);
    const { blockEditors } = useCmsAdminComponents();
    if (!definition)
        return _jsx(NodeViewWrapper, {});
    const Editor = blockEditors?.[definition.name] ?? DefaultCustomBlockEditor;
    return (_jsx(NodeViewWrapper, { "data-cms-custom-block": definition.name, "data-cms-framed": true, className: cn("group/container relative my-6 rounded-md border", selected && SELECTED_RING), children: _jsx(Editor, { definition: definition, values: values, setValue: setValue, content: isContainer(definition) ? _jsx(NodeViewContent, {}) : null, editable: editable, selected: selected }) }));
}
/** Default NodeView of a code fence block: a code input and the preview supplied by the site (`fencePreviews[language]`). */
function FenceBlockNodeView(props) {
    const { definition } = props;
    const lang = definition.syntax.kind === "fence" ? definition.syntax.lang : definition.name;
    const meta = {
        kind: lang,
        label: definition.label,
        placeholder: definition.editor.insert?.code ?? "",
        preview: (value) => (_jsx(LazyFencePreview, { lang: lang, label: definition.label, value: value, emptyText: definition.editor.placeholder ?? t("added.placeholder", { label: definition.label }) })),
    };
    return _jsx(FencePreviewNodeView, { ...props, meta: meta });
}
/**
 * NodeView of an added block. If a blocks extension or site supplies the whole edit view (`blockViews[block name]`) it is used; otherwise a code fence
 * block is drawn as a code and preview view, and a directive block as an attribute and body box.
 */
export function AddedBlockNodeView(props) {
    const definition = addedBlockOfNode(props.node.type.name);
    const { blockViews } = useCmsAdminComponents();
    if (!definition)
        return _jsx(NodeViewWrapper, {});
    const View = blockViews?.[definition.name];
    if (View)
        return _jsx(View, { ...props });
    if (definition.syntax.kind === "fence")
        return _jsx(FenceBlockNodeView, { ...props, definition: definition });
    return _jsx(CustomBlockNodeView, { ...props });
}
