"use client";

import { useTranslator } from "@monti-cms/core/client";
import { useId, useState } from "react";
import { FieldError } from "../../ui/field";
import { Input } from "../../ui/input";
import { Labeled } from "../shared/labeled";
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
}: {
	path: string;
	suggested: string;
	onChange: (path: string) => void;
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
		<div className="flex flex-col gap-4">
			<FlagSwitch
				label={t("collection.hasPage")}
				hint={t("collection.hasPageHint")}
				checked={hasPage}
				onChange={(on) => onChange(on ? suggested || "/:slug" : "")}
			/>
			{hasPage && (
				<Labeled label={t("collection.path")} htmlFor={id} hint={t("collection.pathHint")}>
					<div className="flex items-center gap-1 font-mono text-sm">
						<span className="text-cms-muted-foreground">/</span>
						<Input
							id={id}
							value={shown}
							disabled={disabled}
							autoComplete="off"
							placeholder="posts"
							className="max-w-48 font-mono"
							onChange={(event) => {
								setDraft(event.target.value);
								onChange(pathOfSegment(event.target.value));
							}}
						/>
						<span className="text-cms-muted-foreground">{segment === "" ? ":slug" : "/:slug"}</span>
					</div>
					{issue && <FieldError className="text-xs">{t(`path.${issue}`)}</FieldError>}
				</Labeled>
			)}
		</div>
	);
}
