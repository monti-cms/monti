"use client";

import type { FieldViewProps } from "@monti-cms/admin";
import type { EntryData, EntryForm } from "@monti-cms/admin/kit";
import { cn } from "@monti-cms/admin/kit";
import { MediaThumbnail } from "@monti-cms/admin/media";
import {
	contentPath,
	createTranslator,
	DEFAULT_LOCALE,
	isCollection,
	isLocale,
	localizePath,
	roleField,
	type SchemaCollection,
	SITE_NAME,
} from "@monti-cms/core/client";
import { SEO_ROLES } from "../fields";
import { seoMessages } from "../messages";

const t = createTranslator(seoMessages);

const text = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * Current value of a role field. In a translation, fields that are not per-language read the source value (the same as the properties panel showing the source value).
 */
export function seoRoleValue(
	collection: SchemaCollection,
	role: string,
	form: EntryForm,
	entry: Pick<EntryData, "source"> | null,
): string {
	const stored = roleField(collection, role);
	if (!stored) return "";
	const common = Boolean(entry?.source) && !stored.field.localized;
	return text(common ? entry?.source?.metadata[stored.name] : form[stored.name]);
}

/** Title and description for the search result and share preview. Falls back to the title and summary when empty. */
export function seoPreviewText(collection: SchemaCollection, form: EntryForm, entry: Pick<EntryData, "source"> | null) {
	const value = (role: string) => seoRoleValue(collection, role, form, entry).trim();
	return {
		title: value(SEO_ROLES.title) || form.title.trim(),
		description: value(SEO_ROLES.description) || value("summary"),
	};
}

/** Preview shaped like a search result and a share card. Values come from the field roles. */
export function SeoPreview({
	collection,
	form,
	entry,
}: {
	collection: SchemaCollection;
	form: EntryForm;
	entry: EntryData | null;
}) {
	const { title, description } = seoPreviewText(collection, form, entry);
	const noindex = seoRoleValue(collection, SEO_ROLES.noindex, form, entry) === "noindex";
	const hasImageField = Boolean(roleField(collection, SEO_ROLES.image));
	const imageId = seoRoleValue(collection, SEO_ROLES.image, form, entry);
	const locale = entry?.locale && isLocale(entry.locale) ? entry.locale : DEFAULT_LOCALE;
	const path = localizePath(locale, contentPath(collection, form.slug || "slug") ?? `/${form.slug || "slug"}`);

	return (
		<div className="space-y-3">
			<section aria-label={t("preview.search")} className="space-y-1 rounded-lg border bg-cms-muted/30 p-3">
				<p className="truncate text-[11px] text-cms-muted-foreground">
					{SITE_NAME}
					{path
						.split("/")
						.filter(Boolean)
						.map((part) => ` › ${decodeURIComponent(part)}`)}
				</p>
				<p className="line-clamp-2 font-medium cms-dark:text-[#8ab4f8] text-[#1a0dab] text-sm leading-snug">
					{title || t("preview.noTitle")}
				</p>
				<p className={cn("line-clamp-2 text-xs leading-relaxed", !description && "text-cms-muted-foreground italic")}>
					{description || t("preview.noDescription")}
				</p>
				{noindex && (
					<p className="pt-1 font-medium cms-dark:text-amber-400 text-[11px] text-amber-700">{t("preview.hidden")}</p>
				)}
			</section>

			{hasImageField && (
				<section aria-label={t("preview.share")} className="overflow-hidden rounded-lg border">
					{imageId && <MediaThumbnail mediaId={imageId} className="aspect-[1.91/1] w-full border-b" />}
					<div className="space-y-0.5 p-3">
						<p className="truncate text-[11px] text-cms-muted-foreground">{SITE_NAME}</p>
						<p className="line-clamp-2 font-medium text-sm leading-snug">{title || t("preview.noTitle")}</p>
						{description && (
							<p className="line-clamp-2 text-cms-muted-foreground text-xs leading-relaxed">{description}</p>
						)}
					</div>
				</section>
			)}
		</div>
	);
}

/** The view of the `search` view field. */
export function SeoPreviewView({ collection, form, entry }: FieldViewProps) {
	return isCollection(collection) ? <SeoPreview collection={collection} form={form} entry={entry} /> : null;
}
