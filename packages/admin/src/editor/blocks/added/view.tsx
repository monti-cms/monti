"use client";

import { type BlockDefinition, createTranslator } from "@monti-cms/core/client";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import type { ReactNode } from "react";
import { useCmsAdminComponents } from "../../../admin-components";
import { cn } from "../../../lib/utils/cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select";
import { Switch } from "../../../ui/switch";
import { type FenceEditorMeta, FencePreviewNodeView, LazyFencePreview } from "../fence-preview";
import { blocksMessages } from "../messages";
import {
	AttributeInput,
	BlockSettings,
	BlockSettingsField,
	ContainerToolbar,
	type ContainerValues,
	SELECTED_RING,
	useContainerValues,
	useEditorEditable,
} from "../shared";
import { addedBlockOfNode, isContainer } from "./shared";

const t = createTranslator(blocksMessages);

/** Values received by the edit component that a site or blocks extension registers for a block (`CmsAdminComponents.blockEditors`). */
export interface CustomBlockEditorProps {
	readonly definition: BlockDefinition;
	/** Directive attribute values. Emptied values (empty string, false) are not saved. */
	readonly values: Readonly<ContainerValues>;
	readonly setValue: (name: string, value: string | boolean) => void;
	/** Slot for the container block body. Rendered where the body goes. `null` for single-line blocks. */
	readonly content: ReactNode;
	readonly editable: boolean;
	readonly selected: boolean;
}

/** Default input for one attribute (inside the settings popover). A select if it has choices, a switch for booleans, a text input otherwise. */
function AttributeField({
	name,
	definition,
	values,
	setValue,
	editable,
}: {
	name: string;
	definition: BlockDefinition;
	values: ContainerValues;
	setValue: (name: string, value: string | boolean) => void;
	editable: boolean;
}) {
	const attribute = definition.attributes[name];
	if (!attribute) return null;
	const value = values[name] ?? attribute.defaultValue ?? (attribute.type === "boolean" ? false : "");
	const id = `${definition.name}-${name}`;
	const description = attribute.description ? (
		<p className="text-cms-muted-foreground text-xs">{attribute.description}</p>
	) : null;
	if (attribute.type === "boolean") {
		return (
			<div className="flex flex-col gap-1">
				<label htmlFor={id} className="flex items-center justify-between gap-2">
					<span className="text-cms-muted-foreground">{attribute.label}</span>
					<Switch
						id={id}
						size="sm"
						checked={value === true}
						disabled={!editable}
						onCheckedChange={(checked) => setValue(name, checked)}
					/>
				</label>
				{description}
			</div>
		);
	}
	if (attribute.options) {
		const options = Object.entries(attribute.options).map(([option, label]) => ({ value: option, label }));
		return (
			<BlockSettingsField label={attribute.label} htmlFor={id}>
				<Select
					value={String(value)}
					items={options}
					disabled={!editable}
					onValueChange={(next) => next !== null && setValue(name, String(next))}
				>
					<SelectTrigger id={id} size="sm" className="h-7 w-full text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{description}
			</BlockSettingsField>
		);
	}
	return (
		<BlockSettingsField label={attribute.label} htmlFor={id}>
			<AttributeInput
				id={id}
				value={String(value)}
				readOnly={!editable}
				onCommit={(next) => setValue(name, next)}
				className="h-7 w-full rounded-md border border-cms-input cms-dark:bg-cms-input/30 px-2 text-xs shadow-xs placeholder:text-cms-muted-foreground placeholder:opacity-100 focus-visible:border-cms-ring focus-visible:ring-3 focus-visible:ring-cms-ring/50"
			/>
			{description}
		</BlockSettingsField>
	);
}

/** Default look when no edit component is registered: the block name with the body below it. Attributes are edited in the toolbar's settings popover. */
function DefaultCustomBlockEditor({ definition, values, setValue, content, editable }: CustomBlockEditorProps) {
	const names = Object.keys(definition.attributes);
	return (
		<>
			{editable && names.length > 0 && (
				<ContainerToolbar label={t("added.toolbar", { label: definition.label })}>
					<BlockSettings>
						{names.map((name) => (
							<AttributeField
								key={name}
								name={name}
								definition={definition}
								values={values}
								setValue={setValue}
								editable={editable}
							/>
						))}
					</BlockSettings>
				</ContainerToolbar>
			)}
			<div
				contentEditable={false}
				className={cn("not-prose px-3 py-2 font-medium text-cms-muted-foreground text-xs", content && "border-b")}
			>
				{definition.label}
			</div>
			{content && <div className="px-3">{content}</div>}
		</>
	);
}

/** Default NodeView of a directive block. If an edit component (`blockEditors[block name]`) is registered, it is used to render. */
export function CustomBlockNodeView(props: NodeViewProps) {
	const { node, selected, editor } = props;
	const definition = addedBlockOfNode(node.type.name);
	const [values, setValue] = useContainerValues(props);
	const editable = useEditorEditable(editor);
	const { blockEditors } = useCmsAdminComponents();
	if (!definition) return <NodeViewWrapper />;
	const Editor = blockEditors?.[definition.name] ?? DefaultCustomBlockEditor;
	return (
		<NodeViewWrapper
			data-cms-custom-block={definition.name}
			data-cms-framed
			className={cn("group/container relative my-6 rounded-md border", selected && SELECTED_RING)}
		>
			<Editor
				definition={definition}
				values={values}
				setValue={setValue}
				content={isContainer(definition) ? <NodeViewContent /> : null}
				editable={editable}
				selected={selected}
			/>
		</NodeViewWrapper>
	);
}

/** Default NodeView of a code fence block: a code input and the preview supplied by the site (`fencePreviews[language]`). */
function FenceBlockNodeView(props: NodeViewProps & { readonly definition: BlockDefinition }) {
	const { definition } = props;
	const lang = definition.syntax.kind === "fence" ? definition.syntax.lang : definition.name;
	const meta: FenceEditorMeta = {
		kind: lang,
		label: definition.label,
		placeholder: definition.editor.insert?.code ?? "",
		preview: (value) => (
			<LazyFencePreview
				lang={lang}
				label={definition.label}
				value={value}
				emptyText={definition.editor.placeholder ?? t("added.placeholder", { label: definition.label })}
			/>
		),
	};
	return <FencePreviewNodeView {...props} meta={meta} />;
}

/**
 * NodeView of an added block. If a blocks extension or site supplies the whole edit view (`blockViews[block name]`) it is used; otherwise a code fence
 * block is drawn as a code and preview view, and a directive block as an attribute and body box.
 */
export function AddedBlockNodeView(props: NodeViewProps) {
	const definition = addedBlockOfNode(props.node.type.name);
	const { blockViews } = useCmsAdminComponents();
	if (!definition) return <NodeViewWrapper />;
	const View = blockViews?.[definition.name];
	if (View) return <View {...props} />;
	if (definition.syntax.kind === "fence") return <FenceBlockNodeView {...props} definition={definition} />;
	return <CustomBlockNodeView {...props} />;
}
