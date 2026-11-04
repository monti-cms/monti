import { Empty, PageColumn, PageHeader, TooltipProvider, UiLabelsProvider } from "@monti-cms/ui";
import { type ReactNode, useMemo, useState } from "react";
import { adminMessages } from "./messages";
import { AdminProvider, type Language, useAdmin } from "./operations/admin-context";
import type { Transport } from "./operations/transport";
import { useRead } from "./operations/use-operation";
import { AdminFrame, type FrameCounts, type Place } from "./screens/frame/admin-frame";
import { SchemaBanner } from "./screens/frame/schema-banner";
import { LoginScreen } from "./screens/login/login-screen";
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
			<SchemaBanner />
			{count === 0 ? <Empty title={t("empty.title")} /> : null}
		</PageColumn>
	);
}

function Signed() {
	const counts = useRead<FrameCounts>("frame.counts", {}, { afterWrites: true });
	const [open, setOpen] = useState<Place | null>(null);
	const first = Object.keys(counts.data?.collections ?? {})[0];
	const place = open ?? (first ? { collection: first } : null);
	return (
		<AdminFrame open={place} onOpen={setOpen} counts={counts.data}>
			{place !== null && typeof place === "object" ? (
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
					<Shell denied={denied} />
				</TooltipProvider>
			</AdminUiLabels>
		</AdminProvider>
	);
}
