"use client";

import {
	defineAdminPlugin,
	type EntryView,
	type FieldInputProps,
	type FieldViewProps,
	useAdmin,
	useRead,
} from "@monti-cms/admin";
import { type MediaDetail, mediaValueOf } from "@monti-cms/core";
import { Image, Input, Stack, Switch, Text, Textarea } from "@monti-cms/ui";
import { SEO_FIELDS, SEO_FOLLOWS, SEO_INPUTS, SEO_LIMITS, SEO_PREVIEW } from "./fields";
import { seoWords } from "./messages";

const text = (value: unknown) => (typeof value === "string" ? value : "");
const limitOf = (options: Record<string, unknown>, fallback: number) =>
	typeof options.limit === "number" ? options.limit : fallback;

/** The value an empty field takes on the site, and what it is called: the entry's title, or the field the plugin follows. */
function followed(entry: EntryView, field: string | null, titleName: string): { name: string; value: string } | null {
	if (field === null) return { name: titleName, value: entry.title };
	// A collection without that field follows nothing.
	if (!(field in entry.values)) return null;
	return { name: entry.labels[field] ?? field, value: text(entry.values[field]) };
}

/** A text input that says, while it is empty, which value the site uses instead and how long that is against the recommended length. */
function following(field: (options: Record<string, unknown>) => string | null, limit: number, multiline: boolean) {
	const read = (props: FieldInputProps, language: "ko" | "en") => {
		const words = seoWords[language];
		const from = followed(props.entry, field(props.options), words.entryTitle);
		const most = limitOf(props.options, limit);
		return { words, from, most, own: text(props.value) };
	};
	function FollowingInput(props: FieldInputProps) {
		const { language } = useAdmin();
		const { words, from, most, own } = read(props, language);
		const placeholder = from ? `${words.sameAs(from.name)} · ${from.value.length}/${most}` : `0/${most}`;
		const shared = {
			id: props.id,
			size: "md" as const,
			value: own,
			placeholder,
			disabled: props.readOnly,
		};
		return multiline ? (
			<Textarea {...shared} onChange={(event) => props.onChange(event.target.value)} />
		) : (
			<Input {...shared} onChange={(event) => props.onChange(event.target.value)} />
		);
	}
	/** The count of what was written, once something is: past the recommended length it warns, and nothing is refused. */
	function Count(props: FieldInputProps) {
		const { language } = useAdmin();
		const { most, own } = read(props, language);
		if (own === "") return null;
		return (
			<Text variant="micro" tone={own.length > most ? "warning" : "subtle"}>
				{own.length}/{most}
			</Text>
		);
	}
	return { Input: FollowingInput, Note: Count };
}

/** "Hide from search" as a switch: on is `noindex`, off is no value. */
function NoindexSwitch({ id, value, onChange, readOnly }: FieldInputProps) {
	return (
		<Switch
			id={id}
			checked={value === "noindex"}
			disabled={readOnly}
			onCheckedChange={(on) => onChange(on ? "noindex" : null)}
		/>
	);
}

/** The picture a media value names, as the library has it; `null` while there is none. */
function useImage(value: unknown): string | null {
	const media = mediaValueOf(value)?.media ?? null;
	// A file that is gone (in the trash) is a state the preview knows: it draws no picture. Only a read that got no answer is said at the top.
	const read = useRead<MediaDetail>("media.get", { id: media ?? "" }, { skip: media === null, quiet: true });
	const file = read.data && read.data.id === media ? read.data : null;
	return file && file.kind === "image" ? (file.web?.url ?? file.original.url) : null;
}

/**
 * How the entry would look as a search result and as a shared link, from what the editor holds now: the SEO values, and where they are
 * empty the values the site falls back to.
 */
function SeoPreview({ entry, options }: FieldViewProps) {
	const { language } = useAdmin();
	const words = seoWords[language];
	const follows = { ...SEO_FOLLOWS, ...(options.follows as Partial<typeof SEO_FOLLOWS> | undefined) };
	const title = text(entry.values[SEO_FIELDS.title]).trim() || entry.title.trim();
	const description =
		text(entry.values[SEO_FIELDS.description]).trim() || text(entry.values[follows.description]).trim();
	const own = useImage(entry.values[SEO_FIELDS.image]);
	const cover = useImage(entry.values[follows.image]);
	const image = own ?? cover;
	const place = [entry.siteName, ...(entry.address ?? "").split("/").filter(Boolean).map(decodeURIComponent)];
	return (
		// Two pictures in the panel's own column, set apart by space and a name each: a border is for what floats (README, principle 3).
		<Stack gap={16}>
			<Stack as="section" aria-label={words.searchPreview} gap={4}>
				<Text variant="micro" tone="faint">
					{words.searchPreview}
				</Text>
				<Text variant="micro" tone="subtle" truncate>
					{place.join(" › ")}
				</Text>
				<Text weight="semibold" lines={2} tone={title ? "default" : "faint"}>
					{title || words.noTitle}
				</Text>
				<Text variant="note" lines={2} tone={description ? "muted" : "faint"}>
					{description || words.noDescription}
				</Text>
				{entry.values[SEO_FIELDS.noindex] === "noindex" ? (
					<Text variant="micro" tone="warning">
						{words.hiddenFromSearch}
					</Text>
				) : null}
			</Stack>
			<Stack as="section" aria-label={words.sharePreview} gap={8}>
				<Text variant="micro" tone="faint">
					{words.sharePreview}
				</Text>
				{image ? <Image src={image} alt="" ratio="share" /> : null}
				<Stack gap={4}>
					<Text variant="micro" tone="subtle" truncate>
						{entry.siteName}
					</Text>
					<Text weight="semibold" lines={2} tone={title ? "default" : "faint"}>
						{title || words.noTitle}
					</Text>
					{description ? (
						<Text variant="note" lines={2} tone="muted">
							{description}
						</Text>
					) : null}
				</Stack>
			</Stack>
		</Stack>
	);
}

/** The SEO plugin's browser half: hand it to the admin page (`<AdminPage plugins={[seoAdmin]} />`). */
export const seoAdmin = defineAdminPlugin({
	name: "seo",
	inputs: {
		[SEO_INPUTS.title]: following(() => null, SEO_LIMITS.title, false),
		[SEO_INPUTS.description]: following(
			(options) => (typeof options.follows === "string" ? options.follows : SEO_FOLLOWS.description),
			SEO_LIMITS.description,
			true,
		),
		[SEO_INPUTS.noindex]: NoindexSwitch,
	},
	views: { [SEO_PREVIEW]: SeoPreview },
});
