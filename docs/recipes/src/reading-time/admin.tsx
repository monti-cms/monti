"use client";

import { defineAdminPlugin, type FieldViewProps, toPlainText, useSite } from "@monti-cms/admin";

const WORDS_PER_MINUTE = 200;

function readingMinutes(text: string, locale: string): number {
	let words = 0;
	for (const part of new Intl.Segmenter(locale, { granularity: "word" }).segment(text)) if (part.isWordLike) words += 1;
	return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

function ReadingTimeView({ form, entry }: FieldViewProps) {
	const site = useSite();
	const minutes = readingMinutes(toPlainText(site, form.doc), entry?.locale ?? site.DEFAULT_LOCALE);
	return <p>{minutes} min read</p>;
}

export default defineAdminPlugin({
	components: { fieldViews: { "reading-time": ReadingTimeView } }, // by the `view` name of the field
});
