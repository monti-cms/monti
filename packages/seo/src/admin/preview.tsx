"use client";

import { type FieldViewProps, type SchemaCollectionName, type Site, useSite, useTranslator } from "@monti-cms/admin";
import type { EntryData, EntryForm } from "@monti-cms/admin/kit";
import { cn, commonMessages, MediaThumbnail, Panel, Stack, Text } from "@monti-cms/admin/kit";
import { SEO_ROLES } from "../fields";
import { seoMessages } from "../messages";

const text = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * Current value of a role field. In a translation, fields that are not per-language read the source value (the same as the properties panel showing the source value).
 */
export function seoRoleValue(
	site: Pick<Site, "roleField">,
	collection: SchemaCollectionName,
	role: string,
	form: EntryForm,
	entry: Pick<EntryData, "source"> | null,
): string {
	const stored = site.roleField(collection, role);
	if (!stored) return "";
	const common = Boolean(entry?.source) && !stored.field.localized;
	return text(common ? entry?.source?.metadata[stored.name] : form[stored.name]);
}

/** Title and description for the search result and share preview. Falls back to the title and summary when empty. */
export function seoPreviewText(
	site: Pick<Site, "roleField" | "titleOfValues">,
	collection: SchemaCollectionName,
	form: EntryForm,
	entry: Pick<EntryData, "source"> | null,
) {
	const value = (role: string) => seoRoleValue(site, collection, role, form, entry).trim();
	return {
		title: value(SEO_ROLES.title) || (site.titleOfValues(collection, form) ?? "").trim(),
		description: value(SEO_ROLES.description) || value("summary"),
	};
}

/** Preview shaped like a search result and a share card. Values come from the field roles. */
export function SeoPreview({
	collection,
	form,
	entry,
}: {
	collection: SchemaCollectionName;
	form: EntryForm;
	entry: EntryData | null;
}) {
	const site = useSite();
	const t = useTranslator(seoMessages);
	const tc = useTranslator(commonMessages);
	const { title, description } = seoPreviewText(site, collection, form, entry);
	const noindex = seoRoleValue(site, collection, SEO_ROLES.noindex, form, entry) === "noindex";
	const hasImageField = Boolean(site.roleField(collection, SEO_ROLES.image));
	const imageId = seoRoleValue(site, collection, SEO_ROLES.image, form, entry);
	const locale = entry?.locale && site.isLocale(entry.locale) ? entry.locale : site.DEFAULT_LOCALE;
	const path = site.localizePath(
		locale,
		site.contentPath(collection, form.slug || "slug") ?? `/${form.slug || "slug"}`,
	);

	return (
		<Stack gap={12}>
			<Panel role="region" aria-label={t("preview.search")} background="tool" padding={12}>
				<Stack gap={4}>
					<Text as="p" variant="caption" tone="muted" truncate>
						{site.SITE_NAME}
						{path
							.split("/")
							.filter(Boolean)
							.map((part) => ` › ${decodeURIComponent(part)}`)}
					</Text>
					<p className="line-clamp-2 font-medium monti-dark:text-[#8ab4f8] text-[#1a0dab] text-monti-body">
						{title || tc("untitled")}
					</p>
					<p className={cn("line-clamp-2 text-monti-caption", !description && "text-monti-muted italic")}>
						{description || t("preview.noDescription")}
					</p>
					{noindex && (
						<Text as="p" variant="caption" tone="warning" weight="medium">
							{t("preview.hidden")}
						</Text>
					)}
				</Stack>
			</Panel>

			{hasImageField && (
				<Panel role="region" aria-label={t("preview.share")} overflow="hidden">
					{imageId && <MediaThumbnail mediaId={imageId} size="share" />}
					<Stack gap={2} padding={12}>
						<Text as="p" variant="caption" tone="muted" truncate>
							{site.SITE_NAME}
						</Text>
						<Text as="p" weight="medium" lines={2}>
							{title || tc("untitled")}
						</Text>
						{description && (
							<Text as="p" variant="caption" tone="muted" lines={2}>
								{description}
							</Text>
						)}
					</Stack>
				</Panel>
			)}
		</Stack>
	);
}

/** The view of the `search` view field. */
export function SeoPreviewView({ collection, form, entry }: FieldViewProps) {
	const site = useSite();
	return site.isCollection(collection) ? <SeoPreview collection={collection} form={form} entry={entry} /> : null;
}
