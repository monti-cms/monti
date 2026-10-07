"use client";

import { type BlockDefinition, useTranslator } from "@monti-cms/core/client";
import { cn } from "../../../lib/utils/cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select";
import { Switch } from "../../../ui/switch";
import { type FenceEditorMeta, FencePreviewBlockView, LazyFencePreview } from "../fence-preview";
import { blocksMessages } from "../messages";
import { AttributeInput, BlockSettings, BlockSettingsField, ContainerToolbar } from "../shared";
import { BlockFrame, type BlockValues, Content, useBlockEditor } from "../use-block-editor";
import { isContainer } from "./shared";

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
	values: BlockValues;
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

/**
 * Default view of an added directive block that has no view registered in `blockViews`: the block name with the body below it.
 * Attributes are edited in the toolbar's settings popover.
 */
export function DefaultBlockView() {
	const t = useTranslator(blocksMessages);
	const block = useBlockEditor();
	const { definition, values, editable } = block;
	const names = Object.keys(definition.attributes);
	const container = isContainer(definition);
	return (
		<BlockFrame data-cms-custom-block={definition.name} className="my-6 rounded-md border">
			{editable && names.length > 0 && (
				<ContainerToolbar label={t("added.toolbar", { label: definition.label })}>
					<BlockSettings>
						{names.map((name) => (
							<AttributeField
								key={name}
								name={name}
								definition={definition}
								values={values}
								setValue={block.setValue}
								editable={editable}
							/>
						))}
					</BlockSettings>
				</ContainerToolbar>
			)}
			<div
				contentEditable={false}
				className={cn("not-prose px-3 py-2 font-medium text-cms-muted-foreground text-xs", container && "border-b")}
			>
				{definition.label}
			</div>
			{container && (
				<div className="px-3">
					<Content />
				</div>
			)}
		</BlockFrame>
	);
}

/** Default view of a code fence block: a code input and the preview supplied by the site (`fencePreviews[language]`). */
export function FenceBlockView() {
	const t = useTranslator(blocksMessages);
	const { definition } = useBlockEditor();
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
	return <FencePreviewBlockView meta={meta} />;
}
