import { Box, Checkbox, Grid, Inline, Option, Section, Text, TextButton } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { at, HEADINGS, listedBlocks } from "./schema-draft";
import type { CollectionsDraft } from "./use-collections-draft";

type Choice = { path: string; label: string; mono?: boolean };

/**
 * A document collection's editor tab (CollectionEditor): the blocks, text styles and heading levels its body offers. All are on at first; an
 * admin value, so it changes on the live site too. Turning a block off leaves the entries that use it as they are (doc 01, decisions).
 */
export function EditorTab({ model, collection: c }: { model: CollectionsDraft; collection: string }) {
	const { t } = useAdmin();
	const { draft, catalog } = model;
	if (!catalog) return null;
	const word = (label: string | { key: string }) => t(typeof label === "string" ? label : label.key);
	const blocks: Choice[] = listedBlocks(catalog).map((block) => ({
		path: at.editor(c, "block", block.type),
		label: word(block.label),
	}));
	const marks: Choice[] = catalog.marks.map((mark) => ({
		path: at.editor(c, "mark", mark.type),
		label: word(mark.label),
	}));
	const headings: Choice[] = HEADINGS.map((level) => ({
		path: at.editor(c, "heading", level),
		label: `H${level}`,
		mono: true,
	}));

	const choices = (items: Choice[]) => (
		// Each option row stands in 36px: 6px above and below its line, 16px between rows (the board's grid).
		<Box paddingY={6}>
			<Grid columns={3} gap={16}>
				{items.map((item) => (
					<Option key={item.path}>
						<Checkbox
							checked={draft.value(item.path) !== false}
							onCheckedChange={(checked) => draft.set(item.path, checked)}
						/>
						{item.mono ? (
							<Text mono tone="inherit">
								{item.label}
							</Text>
						) : (
							item.label
						)}
						{model.changed.includes(item.path) ? (
							<Text variant="meta" tone="warning">
								{t("settings.editor.changed")}
							</Text>
						) : null}
					</Option>
				))}
			</Grid>
		</Box>
	);

	return (
		<>
			<Section
				stacked
				dense
				title={
					<Inline gap={12} align="baseline">
						{t("settings.editor.blocks")}
						<TextButton
							variant="quiet"
							size="note"
							onClick={() => {
								for (const block of blocks) draft.set(block.path, true);
							}}
						>
							{t("settings.editor.allowAll")}
						</TextButton>
					</Inline>
				}
			>
				{choices(blocks)}
			</Section>
			<Section stacked dense title={t("settings.editor.marks")}>
				{choices(marks)}
			</Section>
			<Section stacked dense last title={t("settings.editor.headings")}>
				{choices(headings)}
			</Section>
		</>
	);
}
