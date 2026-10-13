import { seedTemplateDocument } from "../store/seed-templates";
import type { MigrationUp } from "./types";

/**
 * Seeds the site config's initial body templates into a new store. It is a run-once job of its own, not a schema step: it runs after every step, and a
 * store that already seeded does not seed again, so deleted templates are not revived.
 */
export const seedInitialBodyTemplates: MigrationUp = async (client, qSchema, context) => {
	for (const t of context.site.config.seed?.templates ?? []) {
		// Seeded as it is stored: its document. A template written as text is read by its format.
		const doc = await seedTemplateDocument(context.site, t, context.formats);
		await client.query(
			`INSERT INTO "${qSchema}".body_templates (id, name, doc, version, created_at, updated_at)
			 VALUES ($1, $2, $3, 1, NOW(), NOW())
			 ON CONFLICT DO NOTHING`,
			[t.id, t.name, JSON.stringify(doc)],
		);
	}
};
