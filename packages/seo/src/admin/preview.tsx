"use client";

import type { FieldViewProps } from "@monti-cms/admin";
import type { EntryData, EntryForm } from "@monti-cms/admin/kit";
import { cn } from "@monti-cms/admin/kit";
import { MediaThumbnail } from "@monti-cms/admin/media";
import { type SchemaCollection, type Site, useSite, useTranslator } from "@monti-cms/core/client";
import { SEO_ROLES } from "../fields";
import { seoMessages } from "../messages";

const text = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * Current value of a role field. In a translation, fields that are not per-language read the source value (the same as the properties panel showing the source value).
 */
export function seoRoleValue(
	site: Pick<Site, "roleField">,
	collection: SchemaCollection,
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
	collection: SchemaCollection,
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
	collection: SchemaCollection;
	form: EntryForm;
	entry: EntryData | null;
}) {
	const site = useSite();
	const t = useTranslator(seoMessages);
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
		<div className="space-y-3">
			<section aria-label={t("preview.search")} className="space-y-1 rounded-lg border bg-cms-muted/30 p-3">
				<p className="truncate text-[11px] text-cms-muted-foreground">
					{site.SITE_NAME}
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
						<p className="truncate text-[11px] text-cms-muted-foreground">{site.SITE_NAME}</p>
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
	const site = useSite();
	return site.isCollection(collection) ? <SeoPreview collection={collection} form={form} entry={entry} /> : null;
}
