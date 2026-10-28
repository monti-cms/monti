"use client";

import { SiteProvider, useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Stack, Text, TodoItem } from "@monti-cms/ui";
import { Component, type ReactNode, useMemo, useRef, useState } from "react";
import { type EntryForm, type EntryFormPatch, emptyFormOf } from "../entries/entry-form";
import { InspectorPanel } from "../entries/inspector-panel";
import { SchemaFields } from "../entries/schema-fields";
import { EntryFormProvider } from "../entries/use-field";
import { placeOfProblem } from "./collection-problems";
import { useSchemaEdit } from "./controls";
import { draftSiteOf } from "./draft-site";
import { schemaFieldsMessages } from "./fields.messages";
import { schemaProblemMessages } from "./problems.messages";
import { collectionsOf, type FieldPlace, fieldAt, type Obj } from "./schema-model";

/** Catches what the real components throw for a draft that is only half made, so one bad moment does not take the settings page down. */
class PreviewBoundary extends Component<
	{ children: ReactNode; fallback: ReactNode; resetKey: unknown },
	{ failed: boolean }
> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	componentDidUpdate(previous: { resetKey: unknown }) {
		if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
	}
	render() {
		return this.state.failed ? this.props.fallback : this.props.children;
	}
}

const noop = () => {};

/**
 * The form of a collection with nothing in it: the real panel on a local form, so typing, picking and the conditional fields that follow work, and nothing is
 * kept or sent. Documents use the properties panel of the edit screen, items the fields of the record panel.
 */
function PreviewPanel({ collection }: { collection: string }) {
	const site = useSite();
	const [form, setForm] = useState<EntryForm>(() => emptyFormOf(site, collection));
	const value = useMemo(
		() => ({
			collection,
			form,
			setForm: (patch: EntryFormPatch) => setForm((current) => ({ ...current, ...patch })),
		}),
		[collection, form],
	);
	return (
		<EntryFormProvider value={value}>
			{site.isItemCollection(collection) ? (
				<Box grow minHeight={0} overflow="y" padding={16} data-testid="layout-preview-record">
					<SchemaFields />
				</Box>
			) : (
				<InspectorPanel
					incomingReferences={[]}
					isLoadingIncomingReferences={false}
					onRefreshIncomingReferences={noop}
					onSlugChange={(slug) => value.setForm({ slug })}
					onRegenerateSlug={noop}
				/>
			)}
		</EntryFormProvider>
	);
}

/**
 * The properties panel of the edit screen for the schema being edited, running for real: the same components on a site made from the draft, so tabs, groups,
 * required marks, options, help texts and conditional fields are what the editor will show. It is interactive and keeps nothing: writes are refused and nothing
 * is saved. It follows the tree and the sheets as the draft changes.
 */
export function LayoutPreview({
	file,
	collection,
	codeCollections,
	onOpenField,
}: {
	/** The schema file as edited. */
	file: Obj;
	/** The collection shown. */
	collection: string;
	codeCollections: readonly string[];
	/** Opens the sheet of a field that has a problem. */
	onOpenField?: (place: FieldPlace, name: string) => void;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const tp = useTranslator(schemaProblemMessages);
	const { problems } = useSchemaEdit();
	const site = useSite();
	// What stops this collection from being saved: the preview would show a half-made form, so the list of what to fix takes its place.
	const toFix = problems.filter((problem) => problem.area === "collections" && problem.collection === collection);
	const made = useMemo(() => draftSiteOf(site, file, codeCollections), [site, file, codeCollections]);
	// While the draft cannot be made (a half-typed name), the last one that could stays.
	const lastGood = useRef<ReturnType<typeof draftSiteOf>>(null);
	if (made) lastGood.current = made;
	const draft = made ?? lastGood.current;
	const problem = (
		<Box padding={16}>
			<Text as="p" variant="caption" tone="muted">
				{t("layout.previewUnavailable")}
			</Text>
		</Box>
	);

	return (
		<Stack
			gap={0}
			grow
			minHeight={0}
			overflow="hidden"
			radius="lg"
			border="all"
			background="page"
			data-testid="layout-preview"
		>
			<Box shrink={false} border="bottom" background="tool" paddingX={16} paddingY={8}>
				<Text as="p" variant="caption" tone="muted">
					{tp("preview.label")}
				</Text>
			</Box>
			{toFix.length > 0 ? (
				<Stack gap={8} padding={16} overflow="y" data-testid="layout-preview-problems">
					<Box paddingX={8}>
						<Text as="p" variant="note" tone="muted">
							{tp("preview.fix")}
						</Text>
					</Box>
					{toFix.map((item) => {
						const where = placeOfProblem(item);
						const field = where ? fieldAt(collectionsOf(file)[collection] ?? {}, where.place, where.name) : undefined;
						return (
							<TodoItem
								key={`${item.path}:${item.code}`}
								blocking
								title={typeof field?.label === "string" && field.label !== "" ? field.label : (item.field ?? item.path)}
								detail={tp(`problem.${item.code}` as "problem.options")}
								onOpen={where && onOpenField ? () => onOpenField(where.place, where.name) : undefined}
							/>
						);
					})}
				</Stack>
			) : draft?.isCollection(collection) ? (
				<SiteProvider site={draft}>
					<PreviewBoundary fallback={problem} resetKey={draft}>
						<PreviewPanel key={collection} collection={collection} />
					</PreviewBoundary>
				</SiteProvider>
			) : (
				problem
			)}
		</Stack>
	);
}
