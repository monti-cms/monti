"use client";

import { useSite, useTranslator } from "@monti-cms/core/client";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { defaultTab, isDrawnField, layoutGroupsOfSchema } from "../entries/layout-groups";
import { schemaMessages } from "./messages";
import { fieldsOf, layoutOf, type Obj, titleFieldName } from "./schema-model";

/** One field as the panel draws it, with an input that does nothing. */
function InertField({ name, field }: { name: string; field: Obj }) {
	const label = typeof field.label === "string" && field.label !== "" ? field.label : name;
	const id = `layout-preview-${name}`;
	const kind = String(field.kind);
	return (
		<div className="space-y-1.5" data-testid={`preview-field-${name}`}>
			<Label htmlFor={id} className="text-xs">
				{label}
			</Label>
			{kind === "view" || kind === "backlink" ? (
				<div id={id} className="rounded-md border border-dashed px-2.5 py-1.5 text-cms-muted-foreground text-xs">
					{kind === "view" ? String(field.view ?? name) : label}
				</div>
			) : kind === "media" ? (
				<div id={id} className="h-16 rounded-md border border-dashed" />
			) : (
				<Input id={id} readOnly tabIndex={-1} aria-readonly className="pointer-events-none h-8 bg-cms-muted/30" />
			)}
		</div>
	);
}

/**
 * The properties panel of the edit screen for the layout being edited: the same grouping (`layoutGroupsOfSchema`, which the real panel uses) and the same
 * rules for what is drawn (not the title, not hidden fields), with inputs that do nothing. It reads the draft, so it follows the tree as it changes.
 * Documents draw their groups plainly under a title; items (the record panel) let a group be folded, so a group that starts collapsed is closed here.
 */
export function LayoutPreview({ collection }: { collection: Obj }) {
	const t = useTranslator(schemaMessages);
	const site = useSite();
	const first = defaultTab(site);
	const fields = fieldsOf(collection);
	const titleName = titleFieldName(collection);
	const layout = layoutOf(collection);
	const groups = layoutGroupsOfSchema({
		fields: fields as Record<string, { tab?: string }>,
		...(layout.length > 0 ? { layout } : {}),
	});
	const tabs = [...new Set([first, ...groups.map((group) => group.tab ?? first)])];
	const [chosen, setChosen] = useState(first);
	const tab = tabs.includes(chosen) ? chosen : first;
	const isItem = collection.kind === "item";
	const drawn = (name: string) => {
		const field = fields[name];
		return field !== undefined && name !== titleName && isDrawnField(field as { kind: string; hidden?: boolean });
	};

	return (
		<Tabs
			value={tab}
			onValueChange={(value) => setChosen(String(value))}
			aria-label={t("layout.previewTitle")}
			className="gap-0 overflow-hidden rounded-lg border bg-cms-background text-sm"
			data-testid="layout-preview"
		>
			<TabsList variant="line" className="h-10 w-full shrink-0 justify-start gap-3 border-b px-4">
				{tabs.map((name) => (
					<TabsTrigger key={name} value={name} className="flex-none px-0 text-xs">
						{name}
					</TabsTrigger>
				))}
			</TabsList>
			{tabs.map((name) => {
				const inTab = groups.filter((group) => (group.tab ?? first) === name);
				const shown = inTab
					.map((group) => ({ group, names: group.fields.filter(drawn) }))
					.filter((item) => item.names.length > 0);
				return (
					<TabsContent key={name} value={name} className="space-y-4 px-4 py-4">
						{shown.length === 0 && <p className="text-cms-muted-foreground text-xs">{t("layout.previewEmpty")}</p>}
						{shown.map(({ group, names }, index) => {
							const body = names.map((fieldName) => (
								<InertField key={fieldName} name={fieldName} field={fields[fieldName] as Obj} />
							));
							if (!group.group || (!isItem && shown.length === 1)) {
								return (
									<div key={`${group.group ?? "group"}-${index}`} className="space-y-4">
										{body}
									</div>
								);
							}
							const folded = isItem && group.collapsed === true;
							return (
								<section
									key={`${group.group}-${index}`}
									aria-label={group.group}
									data-collapsed={folded ? "" : undefined}
									className="space-y-4 border-t pt-4 first:border-t-0 first:pt-0"
								>
									<h3 className="flex items-center gap-1 font-medium text-[11px] text-cms-muted-foreground uppercase tracking-wide">
										{isItem && <ChevronRight aria-hidden className={`size-3.5 ${folded ? "" : "rotate-90"}`} />}
										{group.group}
									</h3>
									{!folded && body}
								</section>
							);
						})}
					</TabsContent>
				);
			})}
		</Tabs>
	);
}
