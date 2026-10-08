"use client";

import type { FieldViewProps } from "@monti-cms/admin";
import { toPlainText, useSite } from "@monti-cms/core/client";
import { readingMinutes } from "./reading-time";

/**
 * The screen of the view field `{ kind: "view", view: "reading-time" }`. It stores nothing: `form` is the entry as it is being edited (the body
 * is `form.doc`), so the number follows the typing, not only the last save.
 */
export function ReadingTimeView({ form, entry }: FieldViewProps) {
	const site = useSite();
	const locale = entry?.locale ?? site.DEFAULT_LOCALE;
	const minutes = readingMinutes(toPlainText(site, form.doc), locale);
	return <p data-reading-time={minutes}>{minutes} min read</p>;
}
