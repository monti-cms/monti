"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Affix, FormFieldError, Inline, Stack } from "@monti-cms/ui";
import { useId, useState } from "react";
import { schemaCollectionMessages } from "./collection.messages";
import { FlagSwitch, useSchemaEdit } from "./controls";
import { pathProblem } from "./schema-model";

/**
 * The part of an address that can be edited on its own: `/posts/:slug` is `posts` between a fixed `/` and a fixed `/:slug`.
 */
export function segmentOf(path: string): string {
	const clean = path.trim().replace(/^https?:\/\/[^/]+/i, "");
	const withoutSlug = clean.replace(/\/:slug(?:\/.*)?$|:slug$/, "");
	return withoutSlug.replace(/^\/+|\/+$/g, "").replace(/[\s:]/g, "");
}

/** The address a segment makes: `posts` is `/posts/:slug`, nothing is `/:slug`. Spaces and colons cannot be part of it, and the slashes around it are the page's own. */
export function pathOfSegment(segment: string): string {
	const clean = segment.replace(/[\s:]/g, "").replace(/^\/+|\/+$/g, "");
	return clean === "" ? "/:slug" : `/${clean}/:slug`;
}

/**
 * Whether the entries have a page on the site and, if they do, the address of it. A collection without an address has no page, so its entries cannot be linked to from a body.
 * `path` is empty for none. `suggested` is the address that is filled in when the page is turned on.
 */
export function PublicPathField({
	path,
	suggested,
	onChange,
	revert,
}: {
	path: string;
	suggested: string;
	onChange: (path: string) => void;
	/** Puts the saved address back; given only while the address differs from the saved file. */
	revert?: () => void;
}) {
	const t = useTranslator(schemaCollectionMessages);
	const { disabled } = useSchemaEdit();
	const id = useId();
	const hasPage = path.trim() !== "";
	const segment = segmentOf(path);
	// What is being typed: it may end in a slash that the address does not have yet (`blog/` on the way to `blog/posts`).
	const [draft, setDraft] = useState(segment);
	const shown = pathOfSegment(draft) === path ? draft : segment;
	const issue = hasPage ? pathProblem(path) : null;
	return (
		<Stack gap={4} paddingBottom={hasPage ? 12 : undefined}>
			<FlagSwitch
				label={t("collection.path")}
				revert={revert}
				checked={hasPage}
				onChange={(on) => onChange(on ? suggested || "/:slug" : "")}
			/>
			{hasPage && (
				<Inline justify="end">
					<Stack gap={8} width="full" maxWidth="panel">
						<Affix
							id={id}
							aria-label={t("collection.path")}
							prefix="/"
							suffix={segment === "" ? ":slug" : "/:slug"}
							value={shown}
							disabled={disabled}
							autoComplete="off"
							placeholder="posts"
							onChange={(event) => {
								setDraft(event.target.value);
								onChange(pathOfSegment(event.target.value));
							}}
						/>
						{issue && <FormFieldError>{t(`path.${issue}`)}</FormFieldError>}
					</Stack>
				</Inline>
			)}
		</Stack>
	);
}
