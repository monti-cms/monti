import { Empty, PageColumn, PageHeader, Toaster, TooltipProvider, UiLabelsProvider } from "@monti-cms/ui";
import { type ReactNode, useMemo, useState } from "react";
import { LeaveGuardProvider, useLeave } from "./draft/leave-guard";
import { adminMessages } from "./messages";
import { AdminProvider, type Language, useAdmin } from "./operations/admin-context";
import type { Transport } from "./operations/transport";
import { useRead } from "./operations/use-operation";
import { AdminFrame, type FrameCounts, type Place } from "./screens/frame/admin-frame";
import { LoginScreen } from "./screens/login/login-screen";
import { CollectionsScreen } from "./screens/settings/collections-screen";
import { useSession } from "./session";

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

type SchemaRead = {
	schema: { collections: Record<string, { path: string }> };
	adminValues: Record<string, { label?: string }>;
};

/**
 * A collection's page. Its list is doc 06's; until then a collection with no entries shows the empty line (flow 8, step 03). Its three ways to start
 * lead to the editor and the tools, which are not built yet, so they are not shown (T40).
 */
function CollectionPage({ name, count }: { name: string; count: number }) {
	const { t } = useAdmin();
	const { data } = useRead<SchemaRead>("schema.read");
	return (
		<PageColumn width="list">
			<PageHeader title={data?.adminValues[name]?.label ?? name} meta={data?.schema.collections[name]?.path} />
			{count === 0 ? <Empty title={t("empty.title")} /> : null}
		</PageColumn>
	);
}

function Signed() {
	const counts = useRead<FrameCounts>("frame.counts", {}, { afterWrites: true });
	const [open, setOpen] = useState<Place | null>(null);
	const [review, setReview] = useState(0);
	// Every move of the frame asks first when the open screen has unsaved changes (doc 05, flow 11 step 04).
	const leave = useLeave();
	const first = Object.keys(counts.data?.collections ?? {})[0];
	const place = open ?? (first ? { collection: first } : null);
	const go = (next: Place) => leave(() => setOpen(next));
	return (
		<AdminFrame
			open={place}
			onOpen={go}
			onReview={() =>
				leave(() => {
					setOpen("settings");
					setReview((count) => count + 1);
				})
			}
			counts={counts.data}
		>
			{place === "settings" ? (
				<CollectionsScreen onOpen={go} review={review} />
			) : place !== null && typeof place === "object" ? (
				<CollectionPage name={place.collection} count={counts.data?.collections[place.collection] ?? 0} />
			) : null}
		</AdminFrame>
	);
}

function Shell({ denied }: { denied?: string }) {
	const session = useSession();
	if (!session.state) return null;
	if (!session.state.session)
		return <LoginScreen state={session.state} denied={denied} onSignedIn={() => void session.reload()} />;
	return <Signed />;
}

/**
 * The admin (doc 15): the login screen until there is a session, then the frame. It reaches the server only through `transport` (build.md rule 3).
 */
export function MontiAdmin({
	transport,
	siteName,
	language = "ko",
	apiBase,
	denied,
}: {
	transport: Transport;
	siteName: string;
	language?: Language;
	apiBase?: string;
	/** The GitHub account that was turned away (`?denied=` on the admin's address). */
	denied?: string;
}) {
	return (
		<AdminProvider transport={transport} siteName={siteName} language={language} apiBase={apiBase}>
			<AdminUiLabels>
				<TooltipProvider>
					<LeaveGuardProvider>
						<Shell denied={denied} />
					</LeaveGuardProvider>
					<Toaster />
				</TooltipProvider>
			</AdminUiLabels>
		</AdminProvider>
	);
}
