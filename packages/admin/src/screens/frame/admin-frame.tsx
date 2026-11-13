import type { FolderNode } from "@monti-cms/core";
import {
	Count,
	folderTree,
	Icon,
	IconButton,
	Inline,
	Sidebar,
	SidebarContent,
	SidebarFoot,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarProvider,
	SidebarRailToggle,
	SidebarScreenMode,
	Stack,
	Text,
} from "@monti-cms/ui";
import { Document, Image, RecentlyViewed, SettingsAdjust, Spark, Tag, Tools, TrashCan } from "@monti-cms/ui/icons";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FolderFilesProvider, useGiveFolderFiles } from "../../media/folder-files";
import { useFolderDrop } from "../../media/use-file-drop";
import { useMoveMedia } from "../../media/use-media-actions";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { href } from "../../route";
import { type FolderScope, useFolders } from "../list/folders";
import { SchemaBanner } from "./schema-banner";
import { SessionEndedBanner } from "./session-ended";
import { useScreenMode, useSidebarRail } from "./use-screen-mode";

/** A sidebar place: a collection by name, or one of the fixed rows. */
export type Place = { collection: string } | "media" | "trash" | "activity" | "tools" | "settings";

type SchemaRead = {
	schema: { collections: Record<string, { kind: "document" | "item" }> };
	adminValues: Record<string, { label?: string; folders?: boolean }>;
};
export type FrameCounts = {
	collections: Record<string, number>;
	trash: number;
	failedDeliveries: number;
	/** Deliveries queued and not tried yet: while any is, the counts are read again (a delivery fails after its write has answered). */
	deliveriesOnTheWay: number;
};

const CornerContext = createContext<((covered: boolean) => void) | null>(null);

/** A panel docked at the page's right edge covers the ✦ button in the frame's corner while `covered` (common.md: the button goes under the panel). */
export function useCoverCorner(covered: boolean) {
	const cover = useContext(CornerContext);
	useEffect(() => {
		if (!cover || !covered) return;
		cover(true);
		return () => cover(false);
	}, [cover, covered]);
}

const same = (a: Place | null, b: Place) =>
	a !== null && (typeof a === "string" || typeof b === "string" ? a === b : a.collection === b.collection);

function Row({
	place,
	open,
	icon,
	name,
	count,
	tone,
	railDot,
	onOpen,
	children,
}: {
	place: Place;
	open: Place | null;
	icon: ReactNode;
	name: string;
	/** Only a number above zero shows: a new site has no counts (doc 15). */
	count?: number;
	tone?: "warning";
	/** Folded, a count cannot show: a dot on the icon says there is something to look at, and these words name it. */
	railDot?: string;
	onOpen: (place: Place) => void;
	/** Under the row while it is open: its folders (doc 07). */
	children?: ReactNode;
}) {
	const active = same(open, place);
	const shown = count && count > 0 ? String(count) : undefined;
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				isActive={active}
				tooltip={shown ? `${name} ${shown}` : name}
				aria-current={active ? "page" : undefined}
				railDot={shown ? railDot : undefined}
				onClick={() => onOpen(place)}
			>
				{icon}
				<span>{name}</span>
				{shown ? <SidebarMenuBadge tone={tone}>{shown}</SidebarMenuBadge> : null}
			</SidebarMenuButton>
			{active ? children : null}
		</SidebarMenuItem>
	);
}

/**
 * The open collection's folders under its row (doc 07, sidebar.md): a row opens its folder, the open one is picked. Deeper than four levels is drawn
 * at the fourth.
 */
function FolderTree({ scope, open, on }: { scope: FolderScope; open: string | null; on: boolean }) {
	const { t } = useAdmin();
	const folders = useFolders(scope, on);
	if (folders.list.length === 0) return null;
	const tree = folderTree(folders.list.map((folder) => Math.min(folder.depth, 3)));
	return (
		<SidebarMenuSub aria-label={t("folders.tree")}>
			{folders.list.map((folder, index) => (
				<FolderTreeRow key={folder.id} folder={folder} scope={scope} open={folder.id === open} tree={tree[index]} />
			))}
		</SidebarMenuSub>
	);
}

/** One folder of the tree. In the media library's it is also a place to drop files on, as a folder tile is (flow 6, doc 07). */
function FolderTreeRow({
	folder,
	scope,
	open,
	tree,
}: {
	folder: FolderNode;
	scope: FolderScope;
	open: boolean;
	tree: ReturnType<typeof folderTree>[number] | undefined;
}) {
	const move = useMoveMedia();
	const give = useGiveFolderFiles();
	const drop = useFolderDrop({
		// Files from outside go up into the folder, as on its tile: the media screen sends them (T106).
		onFiles: scope === "media" && give ? (files) => give.files(files, folder.id) : undefined,
		onMove: (ids) => void move(ids, folder.id),
	});
	// The screen's hint at the bottom says the folder the files are over.
	const overMedia = scope === "media" && drop.files;
	useEffect(() => {
		if (!overMedia || !give) return;
		give.over(folder.name);
		return () => give.over(null);
	}, [overMedia, folder.name, give]);
	const params = new URLSearchParams({ folder: folder.id });
	return (
		<li>
			<SidebarMenuSubButton
				href={href(
					scope === "media" ? { screen: "media", params } : { screen: "list", collection: scope.collection, params },
				)}
				isActive={open}
				aria-current={open ? "page" : undefined}
				depth={Math.min(folder.depth, 3) as 0 | 1 | 2 | 3}
				tree={tree}
				dropTarget={scope === "media" && drop.target}
				{...(scope === "media" ? drop.handlers : {})}
			>
				<span>{folder.name}</span>
				{folder.count > 0 ? <Count>{folder.count}</Count> : null}
			</SidebarMenuSubButton>
		</li>
	);
}

/**
 * The admin's frame (doc 15): the sidebar drawn from the schema and `frame.counts`, the banners the schema's state calls for, and the screen. No
 * collection is named in this code: adding one to the schema adds its row.
 */
export function AdminFrame({
	open,
	onOpen,
	onReview,
	counts,
	folder = null,
	assistant = null,
	children,
}: {
	open: Place | null;
	/** The folder open in the list, picked in its collection's tree. */
	folder?: string | null;
	onOpen: (place: Place) => void;
	/** Opens the review of a schema file edited by hand (the banner's review button, T16). */
	onReview?: () => void;
	/** The sidebar's numbers; the app reads them and reads them again after a write that changes them. */
	counts: FrameCounts | null;
	/**
	 * The site's assistant, when it has one: the ✦ in the page's corner opens its panel, which then stands at the page's right edge. `null` on a
	 * site without one: no ✦ is drawn.
	 */
	assistant?: { open: boolean; onOpen: () => void; panel: ReactNode } | null;
	children: ReactNode;
}) {
	const { t, siteName } = useAdmin();
	// Read again after every write: a saved collection's label and a new collection's row show at once (flow 4, step 06).
	const schema = useRead<SchemaRead>("schema.read", {}, { afterWrites: true });
	const [mode, setMode] = useScreenMode();
	const [covered, setCovered] = useState(false);
	// Closing the assistant's panel hands the focus back to the button that opened it, which is drawn again as the panel goes.
	const corner = useRef<HTMLButtonElement>(null);
	const assistantOpen = assistant?.open ?? false;
	const wasOpen = useRef(assistantOpen);
	useEffect(() => {
		if (wasOpen.current && !assistantOpen) corner.current?.focus();
		wasOpen.current = assistantOpen;
	}, [assistantOpen]);
	const cover = useMemo(() => (next: boolean) => setCovered(next), []);
	const [rail, setRail] = useSidebarRail();
	const collections = Object.entries(schema.data?.schema.collections ?? {});
	const state = schema.data;
	return (
		<Text as="div" variant="body">
			<FolderFilesProvider>
				<SidebarProvider fixed rail={rail} onRailChange={setRail}>
					<Sidebar label={t("frame.menu")}>
						<SidebarHeader>
							<Text variant="title" truncate>
								{siteName}
							</Text>
							<SidebarRailToggle />
						</SidebarHeader>
						<SidebarContent>
							<SidebarGroup>
								<SidebarGroupContent>
									<SidebarMenu aria-label={t("frame.content")}>
										{collections.map(([name, collection]) => (
											<Row
												key={name}
												place={{ collection: name }}
												open={open}
												icon={collection.kind === "item" ? <Tag /> : <Document />}
												name={state?.adminValues[name]?.label ?? name}
												count={counts?.collections[name]}
												onOpen={onOpen}
											>
												<FolderTree
													scope={{ collection: name }}
													open={folder}
													on={state?.adminValues[name]?.folders === true}
												/>
											</Row>
										))}
										<Row place="media" open={open} icon={<Image />} name={t("frame.media")} onOpen={onOpen}>
											<FolderTree scope="media" open={folder} on />
										</Row>
									</SidebarMenu>
								</SidebarGroupContent>
							</SidebarGroup>
						</SidebarContent>
						<SidebarFooter>
							<SidebarMenu aria-label={t("frame.manage")}>
								<Row
									place="trash"
									open={open}
									icon={<TrashCan />}
									name={t("frame.trash")}
									count={counts?.trash}
									onOpen={onOpen}
								/>
								{/* Failed deliveries are counted on the log that shows them, in the warning tone (doc 13, 2026-11-12). */}
								<Row
									place="activity"
									open={open}
									icon={<RecentlyViewed />}
									name={t("frame.activity")}
									count={counts?.failedDeliveries}
									tone="warning"
									railDot={t("frame.failedDeliveries")}
									onOpen={onOpen}
								/>
								<Row place="tools" open={open} icon={<Tools />} name={t("frame.tools")} onOpen={onOpen} />
								<Row
									place="settings"
									open={open}
									icon={<SettingsAdjust />}
									name={t("frame.settings")}
									onOpen={onOpen}
								/>
							</SidebarMenu>
							<SidebarFoot>
								<SidebarScreenMode
									value={mode}
									onValueChange={setMode}
									labels={{
										label: t("frame.mode"),
										system: t("frame.system"),
										light: t("frame.light"),
										dark: t("frame.dark"),
									}}
								/>
							</SidebarFoot>
						</SidebarFooter>
					</Sidebar>
					<SidebarInset
						fixed
						// The whole site's states, broader first: an ended session over a schema change (common.md, banners).
						banner={
							<>
								<SessionEndedBanner />
								<SchemaBanner onReview={onReview} />
							</>
						}
						// No assistant on the site: no button. Its panel open, or another docked at the edge: the button is under it.
						corner={
							covered || !assistant || assistant.open ? undefined : (
								<IconButton ref={corner} label={t("frame.assistant")} onClick={assistant.onOpen}>
									<Icon icon={Spark} size="lg" />
								</IconButton>
							)
						}
					>
						<CornerContext.Provider value={cover}>
							<Stack gap={0} grow minWidth={0} minHeight={0} container>
								<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
									{/* The page scrolls here, one bar at its right edge (or beside a docked panel), the header with it (2026-11-06, owner). */}
									<Stack gap={0} grow minWidth={0} minHeight={0} container overflow="y">
										{children}
									</Stack>
									{assistant?.open ? assistant.panel : null}
								</Inline>
							</Stack>
						</CornerContext.Provider>
					</SidebarInset>
				</SidebarProvider>
			</FolderFilesProvider>
		</Text>
	);
}
