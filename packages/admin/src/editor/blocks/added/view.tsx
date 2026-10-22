"use client";

import type { BlockDefinition } from "@monti-cms/core";
import { useTranslator } from "@monti-cms/core/site";
import {
	cn,
	Inline,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	Switch,
	Text,
} from "@monti-cms/ui";
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
		<Text as="p" variant="caption" tone="muted">
			{attribute.description}
		</Text>
	) : null;
	if (attribute.type === "boolean") {
		return (
			<Stack gap="tight">
				<Inline justify="between" gap="condensed">
					<Label htmlFor={id} size="caption" tone="muted">
						{attribute.label}
					</Label>
					<Switch
						id={id}
						size="sm"
						checked={value === true}
						disabled={!editable}
						onCheckedChange={(checked) => setValue(name, checked)}
					/>
				</Inline>
				{description}
			</Stack>
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
					<SelectTrigger id={id} size="sm" width="full">
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
				boxed
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
	// design-system: drawing — the block drawn in the document: a frame with the component name above its body
	return (
		<BlockFrame data-monti-custom-block={definition.name} className="my-spacious rounded-md border">
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
				className={cn(
					"not-prose px-normal py-condensed font-medium text-monti-caption text-monti-muted",
					container && "border-b",
				)}
			>
				{definition.label}
			</div>
			{container && (
				<div className="px-normal">
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
