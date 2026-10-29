"use client";

import { useTranslator } from "@monti-cms/core/site";
import {
	Box,
	BulkToolbar,
	Caret,
	Chip,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	FilterButton,
	MenuShortcut,
	PageToolbar,
	PageToolbarEnd,
	Segmented,
	TextButton,
	ToolbarDivider,
} from "@monti-cms/ui";
import type { ReactNode } from "react";
import { folderChoices, type MediaState, selectAllState, toggleKind, withKind } from "./media-state";
import { mediaMessages } from "./messages";
import type { MediaLibraryView } from "./use-media-library";

const SORTS = ["uploaded", "uploadedAsc", "name", "size"] as const;

/** A condition that is not on: its name and a caret, opening the values to pick (each with how many files it would give). */
function Condition({ name, children }: { name: string; children: ReactNode }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<FilterButton />}>{name}</DropdownMenuTrigger>
			<DropdownMenuContent align="start">{children}</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * The row under the title: the conditions (type, use, alt text), each a name with a menu until a value is picked and then a chip with a × that takes it off;
 * inside a folder, the place to look; and the view at the end. Alt text is a condition of pictures, so it goes while the type is files.
 */
function FilterBar({ library }: { library: MediaLibraryView }) {
	const t = useTranslator(mediaMessages);
	const { state, update, kinds, alts, currentFolder } = library;
	const chip = (label: string, clear: () => void) => (
		<Chip onRemove={clear} removeLabel={t("filter.remove")}>
			{label}
		</Chip>
	);
	return (
		<PageToolbar inset>
			{state.kind !== "all" ? (
				chip(t("chip.kind", { value: t(state.kind === "file" ? "kind.value.file" : "kind.value.image") }), () =>
					update(withKind("all")),
				)
			) : (
				<Condition name={t("filter.kind")}>
					{(["image", "file"] as const).map((kind) => (
						<DropdownMenuCheckboxItem
							key={kind}
							box
							checked={false}
							onCheckedChange={() => update(withKind(toggleKind(state.kind, kind)))}
						>
							{t(kind === "image" ? "kind.image" : "kind.file")}
							<MenuShortcut>{kinds[kind]}</MenuShortcut>
						</DropdownMenuCheckboxItem>
					))}
				</Condition>
			)}
			{state.used !== "all" ? (
				chip(t("chip.used", { value: t(state.used === "used" ? "used.used" : "used.unused") }), () =>
					update({ used: "all" }),
				)
			) : (
				<Condition name={t("filter.used")}>
					{(["used", "unused"] as const).map((used) => (
						<DropdownMenuCheckboxItem key={used} box checked={false} onCheckedChange={() => update({ used })}>
							{t(used === "used" ? "used.used" : "used.unused")}
						</DropdownMenuCheckboxItem>
					))}
				</Condition>
			)}
			{state.kind !== "file" &&
				(state.alt !== "all" ? (
					chip(t("chip.alt", { value: t(state.alt === "none" ? "alt.none" : "alt.has") }), () => update({ alt: "all" }))
				) : (
					<Condition name={t("filter.alt")}>
						{(["none", "has"] as const).map((alt) => (
							<DropdownMenuCheckboxItem key={alt} box checked={false} onCheckedChange={() => update({ alt })}>
								{t(alt === "none" ? "alt.none" : "alt.has")}
								<MenuShortcut>{alts[alt]}</MenuShortcut>
							</DropdownMenuCheckboxItem>
						))}
					</Condition>
				))}
			{library.scoped && currentFolder && (
				<>
					<ToolbarDivider />
					<Segmented
						aria-label={t("scope.label")}
						size="sm"
						inline
						value={state.scope}
						onValueChange={(scope) => update({ scope })}
						options={[
							{ value: "here", label: currentFolder.name },
							{ value: "all", label: t("scope.all") },
						]}
					/>
				</>
			)}
			<PageToolbarEnd>
				<DropdownMenu>
					<DropdownMenuTrigger render={<FilterButton />}>{t(`sort.${state.sort}`)}</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuRadioGroup
							aria-label={t("sort.label")}
							value={state.sort}
							onValueChange={(sort) => update({ sort: sort as MediaState["sort"] })}
						>
							{SORTS.map((sort) => (
								<DropdownMenuRadioItem key={sort} value={sort}>
									{t(`sort.${sort}`)}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
				<Segmented
					aria-label={t("view.label")}
					size="sm"
					inline
					value={library.view}
					onValueChange={library.setView}
					options={[
						{ value: "grid", label: t("view.grid") },
						{ value: "list", label: t("view.list") },
					]}
				/>
			</PageToolbarEnd>
		</PageToolbar>
	);
}

/**
 * What takes the filter row's place while files are picked: how many, to a folder (the top level, the folders, and a new one), the trash, and letting go. The
 * check at the left picks every file the conditions match, not only the ones on this page.
 */
function PickBar({
	library,
	onMove,
	onNewFolder,
	onTrash,
}: {
	library: MediaLibraryView;
	onMove: (folderId: string | null) => void;
	onNewFolder: () => void;
	onTrash: () => void;
}) {
	const t = useTranslator(mediaMessages);
	const { picked, total } = library;
	return (
		<BulkToolbar
			label={t("bulk.count", { count: picked.size })}
			selectAll={{
				state: selectAllState(picked.size, total),
				onChange: (all) => (all ? void library.pickAllMatching() : library.setPicked(new Set())),
				label: t("bulk.selectAll"),
			}}
			clearLabel={t("bulk.clear")}
			onClear={() => library.setPicked(new Set())}
		>
			<DropdownMenu>
				<DropdownMenuTrigger render={<TextButton />}>
					{t("bulk.toFolder")}
					<Caret />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuItem onClick={() => onMove(null)}>{t("bulk.top")}</DropdownMenuItem>
					{folderChoices(library.folders).map(({ folder, depth }) => (
						<DropdownMenuItem key={folder.id} onClick={() => onMove(folder.id)}>
							<Box as="span" paddingX={depth > 0 ? 12 : 0}>
								{folder.name}
							</Box>
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={onNewFolder}>{t("bulk.newFolder")}</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<TextButton onClick={onTrash}>{t("bulk.trash")}</TextButton>
		</BulkToolbar>
	);
}

export function MediaToolbar(props: {
	library: MediaLibraryView;
	onMove: (folderId: string | null) => void;
	onNewFolder: () => void;
	onTrash: () => void;
}) {
	return props.library.picked.size > 0 ? <PickBar {...props} /> : <FilterBar library={props.library} />;
}
