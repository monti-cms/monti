import { Toaster, TooltipProvider, UiLabelsProvider } from "@monti-cms/ui";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { LeaveGuardProvider, useLeave, useLeaveFiles } from "./draft/leave-guard";
import { adminMessages } from "./messages";
import {
	type AdminBlockDefinition,
	AdminProvider,
	type Language,
	type ScreenChannel,
	useAdmin,
} from "./operations/admin-context";
import type { Transport, Uploader } from "./operations/transport";
import { useRead } from "./operations/use-operation";
import { type Route, useRoute } from "./route";
import { EntryEditor } from "./screens/entry/entry-editor";
import { AdminFrame, type FrameCounts, type Place } from "./screens/frame/admin-frame";
import { filterColumn, type ListState, writeState } from "./screens/list/list-query";
import { ListScreen } from "./screens/list/list-screen";
import { LoginScreen } from "./screens/login/login-screen";
import { MediaScreen } from "./screens/media/media-screen";
import { CollectionsScreen } from "./screens/settings/collections-screen";
import { TemplateEditor } from "./screens/templates/template-editor";
import { TemplatesScreen } from "./screens/templates/templates-screen";
import { TrashScreen } from "./screens/trash/trash-screen";
import { SessionProvider, useSession } from "./session";

/** The words the `@monti-cms/ui` parts write themselves, from the admin's dictionary (`ui.*`). */
function AdminUiLabels({ children }: { children: ReactNode }) {
	const { t } = useAdmin();
	const labels = useMemo(
		() =>
			Object.fromEntries(
				Object.keys(adminMessages.messages.en)
					.filter((key) => key.startsWith("ui."))
					.map((key) => key.slice(3))
					.map((name) => [name, t(`ui.${name}`)]),
			),
		[t],
	);
	return <UiLabelsProvider labels={labels}>{children}</UiLabelsProvider>;
}

/** The sidebar row a route belongs to. */
function placeOf(route: Route): Place | null {
	switch (route.screen) {
		case "list":
			return { collection: route.collection };
		case "settings":
			return "settings";
		case "media":
			return "media";
		case "trash":
			return "trash";
		case "place":
			return route.place;
		// The entry and template editors are pages of their own, outside the frame: no row of the sidebar is theirs (doc 15).
		case "entry":
		case "template":
		case "home":
			return null;
	}
}

const routeOf = (place: Place): Route =>
	typeof place === "object"
		? // A collection's row opens its first list: no filters, newest change first (doc 06, decisions).
			{ screen: "list", collection: place.collection, params: new URLSearchParams() }
		: place === "settings"
			? { screen: "settings" }
			: place === "media"
				? { screen: "media", params: new URLSearchParams() }
				: place === "trash"
					? { screen: "trash", params: new URLSearchParams() }
					: { screen: "place", place };

function Signed() {
	const { screen } = useAdmin();
	const counts = useRead<FrameCounts>("frame.counts", {}, { afterWrites: true });
	const { route, go } = useRoute();
	const [review, setReview] = useState(0);
	// Every move of the frame asks first when the open screen has unsaved changes (doc 05, flow 11 step 04).
	const leave = useLeave();
	const leaveFiles = useLeaveFiles();
	const first = Object.keys(counts.data?.collections ?? {})[0];
	// A first visit with no last screen opens the first collection.
	useEffect(() => {
		if (route.screen === "home" && first) go(routeOf({ collection: first }), { replace: true });
	}, [route.screen, first, go]);
	// The assistant shows the admin a list (`list.show`): the query goes in the address, its filters marked as the assistant's.
	useEffect(
		() =>
			screen.on("list.show", (input) => {
				const shown = input as {
					collection: string;
					filters?: ListState["filters"];
					search?: ListState["search"];
					sort?: ListState["sort"];
				};
				const filters = shown.filters ?? [];
				go({
					screen: "list",
					collection: shown.collection,
					params: writeState({
						filters,
						search: shown.search ?? { text: "", in: "all" },
						sort: shown.sort ?? { by: "updatedAt", dir: "desc" },
						page: 1,
						ai: filters.map(filterColumn),
						folder: null,
						everywhere: false,
					}),
				});
			}),
		[screen, go],
	);
	const open = (place: Place) => leave(() => go(routeOf(place)));
	if (route.screen === "entry")
		return (
			<EntryEditor
				key={route.id}
				collection={route.collection}
				id={route.id}
				compare={route.compare ?? null}
				onBack={() => leave(() => go({ screen: "list", collection: route.collection, params: new URLSearchParams() }))}
				onTrash={() => leave(() => go({ screen: "trash", params: new URLSearchParams() }))}
				// The comparison is a step inside the editor: back returns to the editor as it was, with what was typed.
				onCompare={(compare) =>
					leaveFiles(() =>
						go({ screen: "entry", collection: route.collection, id: route.id, ...(compare ? { compare } : {}) }),
					)
				}
				onOpen={(id) => leave(() => go({ screen: "entry", collection: route.collection, id }))}
			/>
		);
	if (route.screen === "template")
		return (
			<TemplateEditor
				key={route.id ?? "new"}
				id={route.id}
				onBack={() => leave(() => go({ screen: "place", place: "tools" }))}
				onSaved={(id) => go({ screen: "template", id }, { replace: true })}
			/>
		);
	return (
		<AdminFrame
			open={placeOf(route)}
			folder={route.screen === "list" || route.screen === "media" ? route.params.get("folder") : null}
			onOpen={open}
			onReview={() =>
				leave(() => {
					go({ screen: "settings" });
					setReview((count) => count + 1);
				})
			}
			counts={counts.data}
		>
			{route.screen === "settings" ? (
				<CollectionsScreen onOpen={open} review={review} />
			) : route.screen === "place" && route.place === "tools" ? (
				<TemplatesScreen onOpen={(id) => go({ screen: "template", id })} />
			) : route.screen === "media" ? (
				<MediaScreen params={route.params} go={go} />
			) : route.screen === "trash" ? (
				<TrashScreen params={route.params} go={go} />
			) : route.screen === "list" ? (
				<ListScreen
					key={route.collection}
					collection={route.collection}
					params={route.params}
					count={counts.data?.collections[route.collection]}
					go={go}
				/>
			) : null}
		</AdminFrame>
	);
}

function Gate({ denied }: { denied?: string }) {
	const resume = useAdmin().session.resume;
	const session = useSession();
	if (!session.state) return null;
	if (!session.state.session)
		return (
			<LoginScreen
				state={session.state}
				denied={denied}
				onSignedIn={() => {
					// Back in after the session ended: the banner goes, and the address brings back the screen that was open.
					resume();
					void session.reload();
				}}
			/>
		);
	return <Signed />;
}

/**
 * The admin (doc 15): the login screen until there is a session, then the frame. It reaches the server only through `transport` (build.md rule 3).
 */
export function MontiAdmin({
	transport,
	uploader,
	siteName,
	language = "ko",
	apiBase,
	denied,
	screen,
	blocks,
}: {
	transport: Transport;
	/** How file bytes go up (doc 09); over HTTP at `apiBase` when left out. */
	uploader?: Uploader;
	siteName: string;
	language?: Language;
	apiBase?: string;
	/** The GitHub account that was turned away (`?denied=` on the admin's address). */
	denied?: string;
	/** The assistant's way to move the screen (`list.show`, `list.select`); the admin makes its own when left out. */
	screen?: ScreenChannel;
	/** The same site block definitions passed to core; their Editor (or Site fallback) renders custom blocks here. */
	blocks?: AdminBlockDefinition[];
}) {
	return (
		<AdminProvider
			transport={transport}
			uploader={uploader}
			siteName={siteName}
			language={language}
			apiBase={apiBase}
			screen={screen}
			blocks={blocks}
		>
			<AdminUiLabels>
				<TooltipProvider>
					<LeaveGuardProvider>
						<SessionProvider>
							<Gate denied={denied} />
						</SessionProvider>
					</LeaveGuardProvider>
					<Toaster />
				</TooltipProvider>
			</AdminUiLabels>
		</AdminProvider>
	);
}
