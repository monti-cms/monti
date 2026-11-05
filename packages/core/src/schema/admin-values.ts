import { z } from "zod";

/** A field's admin values: what only the admin screen and the assistant use, so they change on the live site too. */
export const FieldAdminValues = z.object({
	label: z.string().optional(),
	/** For the assistant: how to fill the field. The screen does not show it. */
	description: z.string().optional(),
	optionLabels: z.record(z.string(), z.string()).optional(),
});

/**
 * How a collection's list looks (doc 06): the column order, the hidden columns, the widths the admin dragged and the page size. Filters and sorting live
 * in the address only.
 */
export const ListPrefs = z.object({
	order: z.array(z.string()).optional(),
	hidden: z.array(z.string()).optional(),
	/** Column id → width in px, for the columns the admin resized; the others keep their kind's width. The screen clamps it to the kind's width. */
	widths: z.record(z.string(), z.number().int().positive().max(480)).optional(),
	pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]).optional(),
});

type LayoutField = string | { group: string; fields: string[] };

/** A collection's admin values (doc 01, "where values live"). */
export const AdminValues = z.object({
	label: z.string().optional(),
	folders: z.boolean().optional(),
	fields: z.record(z.string(), FieldAdminValues).optional(),
	/** The property panel: tabs of fields and groups. Without it, one tab in the schema's order. */
	layout: z
		.array(
			z.object({
				tab: z.string(),
				fields: z.array(z.union([z.string(), z.object({ group: z.string(), fields: z.array(z.string()) })])),
			}),
		)
		.optional() as z.ZodOptional<z.ZodType<{ tab: string; fields: LayoutField[] }[]>>,
	/** What the editor lets the admin put in. The site draws every block either way. */
	editor: z
		.object({
			blocks: z.union([z.literal("all"), z.array(z.string())]),
			marks: z.union([z.literal("all"), z.array(z.string())]),
			headings: z.array(z.number().int().min(1).max(6)),
		})
		.partial()
		.optional(),
	list: ListPrefs.optional(),
});
export type AdminValues = z.infer<typeof AdminValues>;
