import { Inline, Stack, StandalonePage, Toaster, TooltipProvider, UiLabelsProvider } from "@monti-cms/ui";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AssistantPanel } from "./assistant/assistant-panel";
import { ReviewScreen } from "./assistant/review-screen";
import { AssistantProvider, useAssistant } from "./assistant/use-assistant";
import { LeaveGuardProvider, useLeave, useLeaveFiles } from "./draft/leave-guard";
import { adminMessages } from "./messages";
import {
	type AdminBlockDefinition,
	type AdminMarkDefinition,
	AdminProvider,
	type Language,
	type ScreenChannel,
	useAdmin,
} from "./operations/admin-context";
import type { StreamTransport, Transport, Uploader } from "./operations/transport";
import { useRead } from "./operations/use-operation";
import type { AdminPlugin } from "./plugins";
import { href, parseRoute, type Route, useRoute } from "./route";
import { ActivityScreen } from "./screens/activity/activity-screen";
import { DataScreen } from "./screens/data/data-screen";
import { EntryEditor } from "./screens/entry/entry-editor";
import { AdminFrame, type FrameCounts, type Place } from "./screens/frame/admin-frame";
import { ReadFailedBanner } from "./screens/frame/read-failed";
import { KeysScreen } from "./screens/keys/keys-screen";
import { filterColumn, type ListState, writeState } from "./screens/list/list-query";
import { ListScreen } from "./screens/list/list-screen";
import { LoginScreen } from "./screens/login/login-screen";
import { MediaScreen } from "./screens/media/media-screen";
import { SettingsScreen } from "./screens/settings/settings-screen";
import { TemplateEditor } from "./screens/templates/template-editor";
import { TemplatesScreen } from "./screens/templates/templates-screen";
import { ToolPageScreen, ToolsTabs } from "./screens/tools/tools-tabs";
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
		case "activity":
			return "activity";
		case "place":
			return route.place;
		// The entry and template editors are pages of their own, outside the frame: no row of the sidebar is theirs (doc 15).
		case "entry":
		case "template":
		case "home":
		// A proposal's review is the assistant's page: no row of the sidebar is picked (screens/assistant.md).
		case "review":
			return null;
	}
}

const routeOf = (place: Place): Route =>
	typeof place === "object"
		? // A collection's row opens its first list: no filters, newest change first (doc 06, decisions).
			{ screen: "list", collection: place.collection, params: new URLSearchParams() }
		: place === "settings"
			? { screen: "settings", tab: "site" }
			: place === "media"
				? { screen: "media", params: new URLSearchParams() }
				: place === "trash"
					? { screen: "trash", params: new URLSearchParams() }
					: place === "activity"
						? { screen: "activity", params: new URLSearchParams() }
						: { screen: "place", place };

/** The signed-in admin with its assistant: the conversation stays as the screens change under it. */
function Signed() {
	const { route, go } = useRoute();
	const leave = useLeave();
	return (
		<AssistantProvider go={go} leave={leave} at={href(route)}>
			<Screens route={route} go={go} />
		</AssistantProvider>
	);
}

/**
 * A page outside the frame (the editors) with the assistant's panel beside it while it is open: the page keeps the window's height and gives
 * the panel its width.
 */
function BesideAssistant({ panel, children }: { panel: ReactNode; children: ReactNode }) {
	const assistant = useAssistant();
	const beside = assistant.available === true && assistant.open;
	// One tree with the panel open or closed: the page is the same page when the panel comes and goes (made anew, an editor read its entry
	// again and lost its caret each time the panel was opened from it).
	return (
		<Inline gap={0} align="stretch" height={beside ? "screen" : undefined} overflow={beside ? "clip" : undefined}>
			<Stack gap={0} grow minWidth={0}>
				{children}
			</Stack>
			{beside ? panel : null}
		</Inline>
	);
}

/** How long after an answer the frame's counts are read again while a delivery is on its way (the log's own pace, `WATCH_MS`). */
const COUNT_AGAIN_MS = 3000;
/** How many times in a row: a minute, more than a receiver is waited for and tried again at once. */
const COUNT_LOOKS = 20;

function Screens({ route, go }: { route: Route; go: (route: Route, options?: { replace?: boolean }) => void }) {
	const { screen, templates, toolPages, onWrite } = useAdmin();
	const assistant = useAssistant();
	const counts = useRead<FrameCounts>("frame.counts", {}, { afterWrites: true });
	const [review, setReview] = useState(0);
	// Every move of the frame asks first when the open screen has unsaved changes (doc 05, flow 11 step 04).
	const leave = useLeave();
	const leaveFiles = useLeaveFiles();
	// The counts follow this admin's own writes. What happens without one (a delivery that fails after its write answered, another tab's work) is
	// read when the person comes back to the window, and by the activity log while it is open.
	const recount = counts.reload;
	useEffect(() => {
		const again = () => void recount();
		window.addEventListener("focus", again);
		return () => window.removeEventListener("focus", again);
	}, [recount]);
	// A delivery is sent after its write has answered, and fails then: while any is on its way the counts are read again, so the sidebar's
	// failed number comes without another write, on whatever screen is open (doc 13). Not for ever: a host that never sends what it queued
	// (nothing keeps it alive after the answer) would be asked every few seconds for as long as the admin is open.
	const onTheWay = counts.data?.deliveriesOnTheWay ?? 0;
	const looks = useRef(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: each answer of the counts, read or not, starts the next look.
	useEffect(() => {
		if (onTheWay === 0) {
			looks.current = 0;
			return;
		}
		if (looks.current >= COUNT_LOOKS) return;
		const timer = setTimeout(() => {
			looks.current += 1;
			void recount();
		}, COUNT_AGAIN_MS);
		return () => clearTimeout(timer);
	}, [onTheWay, counts.data, counts.refusal, recount]);
	// A write queues new deliveries: the looks start over with it.
	useEffect(
		() =>
			onWrite(() => {
				looks.current = 0;
			}),
		[onWrite],
	);
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
	// A link in an answer names a place of the admin by its address; it opens as a press on any link does.
	const panel = <AssistantPanel onOpen={(address) => leave(() => go(parseRoute(address)))} />;
	if (route.screen === "entry")
		return (
			<BesideAssistant panel={panel}>
				<EntryEditor
					key={route.id}
					collection={route.collection}
					id={route.id}
					compare={route.compare ?? null}
					onBack={() =>
						leave(() => go({ screen: "list", collection: route.collection, params: new URLSearchParams() }))
					}
					onTrash={() => leave(() => go({ screen: "trash", params: new URLSearchParams() }))}
					// The comparison is a step inside the editor: back returns to the editor as it was, with what was typed.
					onCompare={(compare) =>
						leaveFiles(() =>
							go({ screen: "entry", collection: route.collection, id: route.id, ...(compare ? { compare } : {}) }),
						)
					}
					onOpen={(id) => leave(() => go({ screen: "entry", collection: route.collection, id }))}
					onLanguages={() => leave(() => go({ screen: "settings", tab: "languages" }))}
					onActivity={(title) =>
						leave(() =>
							go({
								screen: "activity",
								params: new URLSearchParams({ ...(title ? { q: title } : {}), kind: "assistant" }),
							}),
						)
					}
				/>
			</BesideAssistant>
		);
	if (route.screen === "template")
		return (
			<BesideAssistant panel={panel}>
				<TemplateEditor
					key={route.id ?? "new"}
					id={route.id}
					onBack={() => leave(() => go({ screen: "place", place: "tools" }))}
					onSaved={(id) => go({ screen: "template", id }, { replace: true })}
				/>
			</BesideAssistant>
		);
	return (
		<AdminFrame
			open={placeOf(route)}
			folder={route.screen === "list" || route.screen === "media" ? route.params.get("folder") : null}
			onOpen={open}
			onReview={() => {
				const review = () => {
					go({ screen: "settings", tab: "collections" });
					setReview((count) => count + 1);
				};
				// The review is the settings screen's own: from there nothing is left, so nothing is asked (its tabs share one draft).
				if (route.screen === "settings") review();
				else leave(review);
			}}
			counts={counts.data}
			assistant={assistant.available ? { open: assistant.open, onOpen: () => assistant.setOpen(true), panel } : null}
		>
			{route.screen === "review" ? (
				<ReviewScreen key={route.id} id={route.id} go={go} />
			) : route.screen === "settings" ? (
				// One screen for the four tabs: they share a draft, so a move between them asks nothing and loses nothing (doc 12).
				<SettingsScreen
					tab={route.tab}
					onTab={(tab) => go({ screen: "settings", tab })}
					onOpen={open}
					review={review}
				/>
			) : route.screen === "place" && route.place === "tools" ? (
				// Body templates turned off (settings › admin, doc 03): the tools keep their other tabs, and every way to the tools (the sidebar,
				// the templates' own address) opens the first of them, the data.
				// A plugin's page, while its browser half brings the screen; an address for one it does not bring opens the tools as usual.
				route.page && toolPages.has(`${route.page.plugin}/${route.page.id}`) ? (
					<ToolPageScreen page={route.page} tabs={<ToolsTabs current={route.page} go={go} />} />
				) : route.tab === "keys" ? (
					<KeysScreen tabs={<ToolsTabs current="keys" go={go} />} />
				) : route.tab === "data" || !templates ? (
					<DataScreen tabs={<ToolsTabs current="data" go={go} />} />
				) : (
					<TemplatesScreen
						tabs={<ToolsTabs current="templates" go={go} />}
						onOpen={(id) => go({ screen: "template", id })}
					/>
				)
			) : route.screen === "media" ? (
				<MediaScreen params={route.params} go={go} />
			) : route.screen === "trash" ? (
				<TrashScreen params={route.params} go={go} />
			) : route.screen === "activity" ? (
				<ActivityScreen params={route.params} go={go} recount={recount} />
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
	// Until the session is read there is nothing to draw. A read that did not come is said, with the way to try again: the admin is not left blank.
	if (!session.state) return <StandalonePage banner={<ReadFailedBanner />} />;
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
	streams,
	uploader,
	siteName,
	language = "ko",
	apiBase,
	denied,
	screen,
	blocks,
	marks,
	plugins,
}: {
	transport: Transport;
	/** How streams are listened to (the assistant's run, an apply); over HTTP at `apiBase` when left out. */
	streams?: StreamTransport;
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
	/** The site's mark definitions, from the same module: their cards in the format bar (doc 18). */
	marks?: AdminMarkDefinition[];
	/** The plugins' browser halves (`defineAdminPlugin`): their inputs, views and tool pages (doc 14). */
	plugins?: AdminPlugin[];
}) {
	return (
		<AdminProvider
			transport={transport}
			streams={streams}
			uploader={uploader}
			siteName={siteName}
			language={language}
			apiBase={apiBase}
			screen={screen}
			blocks={blocks}
			marks={marks}
			plugins={plugins}
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
