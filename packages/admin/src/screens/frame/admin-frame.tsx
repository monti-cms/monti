import {
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
	SidebarProvider,
	SidebarRailToggle,
	SidebarScreenMode,
	Stack,
	Text,
} from "@monti-cms/ui";
import { Document, Image, SettingsAdjust, Spark, Tag, Tools, TrashCan } from "@monti-cms/ui/icons";
import type { ReactNode } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { useScreenMode, useSidebarRail } from "./use-screen-mode";

/** A sidebar place: a collection by name, or one of the fixed rows. */
export type Place = { collection: string } | "media" | "trash" | "tools" | "settings";

type SchemaRead = {
	schema: { collections: Record<string, { kind: "document" | "item" }> };
	adminValues: Record<string, { label?: string }>;
};
export type FrameCounts = { collections: Record<string, number>; trash: number; failedDeliveries: number };

const same = (a: Place | null, b: Place) =>
	a !== null && (typeof a === "string" || typeof b === "string" ? a === b : a.collection === b.collection);

function Row({
	place,
	open,
	icon,
	name,
	count,
	tone,
	onOpen,
}: {
	place: Place;
	open: Place | null;
	icon: ReactNode;
	name: string;
	/** Only a number above zero shows: a new site has no counts (doc 15). */
	count?: number;
	tone?: "warning";
	onOpen: (place: Place) => void;
}) {
	const active = same(open, place);
	const shown = count && count > 0 ? String(count) : undefined;
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				isActive={active}
				tooltip={shown ? `${name} ${shown}` : name}
				aria-current={active ? "page" : undefined}
				onClick={() => onOpen(place)}
			>
				{icon}
				<span>{name}</span>
				{shown ? <SidebarMenuBadge tone={tone}>{shown}</SidebarMenuBadge> : null}
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

/**
 * The admin's frame (doc 15): the sidebar drawn from the schema and `frame.counts`, the banners the schema's state calls for, and the screen. No
 * collection is named in this code: adding one to the schema adds its row.
 */
export function AdminFrame({
	open,
	onOpen,
	counts,
	children,
}: {
	open: Place | null;
	onOpen: (place: Place) => void;
	/** The sidebar's numbers; the app reads them and reads them again after a write that changes them. */
	counts: FrameCounts | null;
	children: ReactNode;
}) {
	const { t, siteName } = useAdmin();
	const schema = useRead<SchemaRead>("schema.read");
	const [mode, setMode] = useScreenMode();
	const [rail, setRail] = useSidebarRail();
	const collections = Object.entries(schema.data?.schema.collections ?? {});
	const state = schema.data;
	return (
		<Text as="div" variant="body">
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
										/>
									))}
									<Row place="media" open={open} icon={<Image />} name={t("frame.media")} onOpen={onOpen} />
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
							<Row
								place="tools"
								open={open}
								icon={<Tools />}
								name={t("frame.tools")}
								count={counts?.failedDeliveries}
								tone="warning"
								onOpen={onOpen}
							/>
							<Row place="settings" open={open} icon={<SettingsAdjust />} name={t("frame.settings")} onOpen={onOpen} />
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
					corner={
						<IconButton label={t("frame.assistant")}>
							<Spark className="size-monti-icon-lg" />
						</IconButton>
					}
				>
					<Stack gap={0} grow minWidth={0} minHeight={0} container>
						<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
							<Stack gap={0} grow minWidth={0} minHeight={0} container>
								{children}
							</Stack>
						</Inline>
					</Stack>
				</SidebarInset>
			</SidebarProvider>
		</Text>
	);
}
