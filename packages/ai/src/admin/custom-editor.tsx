"use client";

import {
	cn,
	Field,
	FieldLabel,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@monti-cms/admin/kit";
import { COLLECTION_DEFINITIONS, COLLECTIONS, createTranslator, schemaOf } from "@monti-cms/core/client";
import { useId } from "react";
import { CUSTOM_BLOCKS, type CustomBase, type CustomSurface, customEngines, customResults } from "../custom";
import { customMessages } from "./custom-editor.messages";
import { engineLabel, resultLabel, slotLabel, slotTargetLabel } from "./labels.messages";

const t = createTranslator(customMessages);

/** Picking the basic info of a screen action: name, attach target, result shape. */

type Option = { value: string; label: string };

/** Select field of the AI screen. The closed field shows the name, not the value. */
export function OptionSelect({
	id,
	value,
	options,
	onChange,
	disabled,
	className,
	"aria-label": ariaLabel,
}: {
	id?: string;
	value: string;
	options: readonly Option[];
	onChange: (value: string) => void;
	disabled?: boolean;
	className?: string;
	"aria-label"?: string;
}) {
	return (
		<Select
			value={value}
			items={options}
			disabled={disabled}
			onValueChange={(next) => typeof next === "string" && onChange(next)}
		>
			<SelectTrigger id={id} size="sm" aria-label={ariaLabel} className={cn("w-full min-w-0 text-xs", className)}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value} className="text-xs">
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/** Fields that can have a button next to them (text, URL, relation, select fields). Also picks the option values of conditional fields. The value is `collection:field`. */
const FIELD_OPTIONS = COLLECTIONS.flatMap((collection) =>
	Object.entries(schemaOf(collection).fields).flatMap(([name, field]) => {
		const target = field.kind === "conditional" ? field.discriminant : field;
		return target.kind === "text" || target.kind === "slug" || target.kind === "relation" || target.kind === "select"
			? [{ value: `${collection}:${name}`, label: `${COLLECTION_DEFINITIONS[collection].label} · ${target.label}` }]
			: [];
	}),
);

/** Attach target picker. Names are built in the language at render time. */
const placeOptionsOf = (): ReadonlyArray<{ value: string; label: string; surface: CustomSurface | null }> => [
	{ value: "field", label: t("place.field"), surface: null },
	{ value: "selection", label: slotLabel("selection"), surface: { slot: "selection" } },
	{ value: "insert", label: slotLabel("insert"), surface: { slot: "insert" } },
	...CUSTOM_BLOCKS.map((block) => ({
		value: `block:${block.name}`,
		label: `${slotLabel("block")} · ${block.label}`,
		surface: { slot: "block", block: block.name } as const,
	})),
	{
		value: "image:alt",
		label: `${slotLabel("image")} · ${slotTargetLabel("image", "alt")}`,
		surface: { slot: "image", target: "alt" },
	},
	{
		value: "image:caption",
		label: `${slotLabel("image")} · ${slotTargetLabel("image", "caption")}`,
		surface: { slot: "image", target: "caption" },
	},
	{
		value: "media:filename",
		label: `${t("place.media")} · ${slotTargetLabel("media", "filename")}`,
		surface: { slot: "media", target: "filename" },
	},
	{
		value: "media:defaultAlt",
		label: `${t("place.media")} · ${slotTargetLabel("media", "defaultAlt")}`,
		surface: { slot: "media", target: "defaultAlt" },
	},
	{
		value: "media:defaultCaption",
		label: `${t("place.media")} · ${slotTargetLabel("media", "defaultCaption")}`,
		surface: { slot: "media", target: "defaultCaption" },
	},
];

const placeValue = (surface: CustomSurface) =>
	surface.slot === "field"
		? "field"
		: surface.slot === "block"
			? `block:${surface.block}`
			: "target" in surface
				? `${surface.slot}:${surface.target}`
				: surface.slot;

/** First field slot. If there is no text or URL field, it is the selection menu. */
const firstField = (): CustomSurface => {
	const [collection, field] = (FIELD_OPTIONS[0]?.value ?? "").split(":");
	return collection && field ? { slot: "field", field, collections: [collection] } : { slot: "selection" };
};

/** Result shape and mode matched to the slot. Values that cannot be used become the first value (for relation and select fields, the judge mode comes first). */
const fitted = (base: CustomBase, surface: CustomSurface): CustomBase => {
	const results = customResults(surface);
	const engines = customEngines(surface);
	const engine = base.engine && engines.includes(base.engine) ? base.engine : engines[0];
	return {
		...base,
		surface,
		result: results.includes(base.result) ? base.result : (results[0] ?? "text"),
		...(engine === "decide" ? { engine } : { engine: undefined }),
	};
};

export const NEW_CUSTOM_BASE = (): CustomBase =>
	fitted({ label: "", surface: firstField(), result: "text" }, firstField());

/** Basic info inputs. Changing the attach target turns result shapes and modes that cannot be used there into the first value. */
export function CustomBaseFields({ base, onChange }: { base: CustomBase; onChange: (base: CustomBase) => void }) {
	const ids = { label: useId(), place: useId(), field: useId(), result: useId(), engine: useId() };
	const setSurface = (surface: CustomSurface) => onChange(fitted(base, surface));
	const placeOptions = placeOptionsOf();
	const engines = customEngines(base.surface);
	const fieldValue =
		base.surface.slot === "field" ? `${base.surface.collections?.[0] ?? ""}:${base.surface.field}` : "";
	return (
		<div className="grid gap-5 sm:grid-cols-2">
			<Field className="sm:col-span-2">
				<FieldLabel htmlFor={ids.label}>{t("field.name")}</FieldLabel>
				<Input
					id={ids.label}
					value={base.label}
					maxLength={40}
					onChange={(event) => onChange({ ...base, label: event.target.value })}
					className="h-8 text-xs md:text-xs"
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={ids.place}>{t("field.place")}</FieldLabel>
				<OptionSelect
					id={ids.place}
					value={placeValue(base.surface)}
					options={placeOptions}
					onChange={(value) => {
						const option = placeOptions.find((item) => item.value === value);
						if (option) setSurface(option.surface ?? firstField());
					}}
				/>
			</Field>
			{base.surface.slot === "field" ? (
				<Field>
					<FieldLabel htmlFor={ids.field}>{t("field.field")}</FieldLabel>
					<OptionSelect
						id={ids.field}
						value={fieldValue}
						options={FIELD_OPTIONS}
						onChange={(value) => {
							const [collection, field] = value.split(":");
							if (collection && field) setSurface({ slot: "field", field, collections: [collection] });
						}}
					/>
				</Field>
			) : (
				<div />
			)}
			<Field>
				<FieldLabel htmlFor={ids.result}>{t("field.result")}</FieldLabel>
				<OptionSelect
					id={ids.result}
					value={base.result}
					options={customResults(base.surface).map((result) => ({ value: result, label: resultLabel(result) }))}
					onChange={(result) => onChange({ ...base, result: result as CustomBase["result"] })}
				/>
			</Field>
			{engines.length > 1 && (
				<Field>
					<FieldLabel htmlFor={ids.engine}>{t("field.engine")}</FieldLabel>
					<OptionSelect
						id={ids.engine}
						value={base.engine ?? "generate"}
						options={engines.map((engine) => ({ value: engine, label: engineLabel(engine) }))}
						onChange={(value) => {
							const engine = value as NonNullable<CustomBase["engine"]>;
							onChange({ ...base, engine: engine === "decide" ? engine : undefined });
						}}
					/>
				</Field>
			)}
		</div>
	);
}
