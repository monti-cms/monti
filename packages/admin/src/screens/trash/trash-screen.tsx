"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Inline, PageColumn, PageHeader, SearchBox, Stack, Text, TextButton } from "@monti-cms/ui";
import { useEffect, useState } from "react";
import { commonMessages } from "../../lib/common.messages";
import { AdminLink as Link } from "../../router";
import { shortDate } from "../list-row-dates";
import { AdminFrame, AdminNavProvider } from "../shared/admin-frame";
import { DockedPanel } from "../shared/side-panel";
import { useDebouncedInput } from "../shared/use-debounced";
import { trashMessages } from "./messages";
import { DeleteDialog, EmptyDialog } from "./trash-dialogs";
import { TrashList } from "./trash-list";
import { daysLeftOf } from "./trash-model";
import { TrashPanel } from "./trash-panel";
import { useTrash } from "./use-trash";
import { useTrashActions } from "./use-trash-actions";

// The admin list fetches data in the browser. Render after hydration so Base UI's auto IDs do not mismatch the server HTML.
function useMounted() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	return mounted;
}

/**
 * The trash: one screen for entries, items, folders and media, with the day each was discarded and how long it stays. `now` is the day the days left are
 * counted to (a story holds it still).
 */
export function TrashScreen({ now }: { now?: Date }) {
	const mounted = useMounted();
	const tc = useTranslator(commonMessages);
	if (!mounted)
		return (
			<Stack height="screen" align="center" justify="center" aria-busy="true">
				<Text as="p" tone="subtle" role="status">
					{tc("loading")}
				</Text>
			</Stack>
		);
	return (
		<AdminNavProvider>
			<TrashPage now={now} />
		</AdminNavProvider>
	);
}

function TrashSearch({ view }: { view: ReturnType<typeof useTrash> }) {
	const t = useTranslator(trashMessages);
	const [text, setText] = useDebouncedInput(view.state.search, (search) => view.update({ search }));
	return (
		<Box width="panel">
			<SearchBox aria-label={t("search")} placeholder={t("search")} value={text} onValueChange={setText} />
		</Box>
	);
}

function TrashPage({ now = new Date() }: { now?: Date }) {
	const site = useSite();
	const t = useTranslator(trashMessages);
	const tc = useTranslator(commonMessages);
	const view = useTrash();
	const actions = useTrashActions(view);
	const { folder, state } = view;
	const panelItem = view.panelItem?.type === "folder" ? null : view.panelItem;
	const left = folder ? daysLeftOf(folder, now) : null;
	return (
		<AdminFrame sidebar={{ activeNav: "trash" }}>
			<PageColumn width="list">
				<PageHeader
					title={state.folder ? (folder?.name ?? "") : t("title")}
					meta={
						folder && left !== null
							? t("folder.meta", {
									date: shortDate(site, folder.deletedAt),
									left: t("row.left", { count: left }),
								})
							: undefined
					}
					trail={
						state.folder ? (
							<Inline as="nav" gap={6} aria-label={t("trail.label")}>
								<TextButton variant="underline" render={<Link href={site.adminHref("/trash")} />}>
									{t("trail.root")}
								</TextButton>
								<span aria-hidden="true">/</span>
							</Inline>
						) : undefined
					}
				>
					{state.folder
						? folder && (
								<>
									<TextButton onClick={() => void actions.restore([folder])}>{t("folder.restore")}</TextButton>
									<TextButton variant="danger" onClick={() => void actions.requestDelete([folder])}>
										{tc("lifecycle.deletePermanently")}
									</TextButton>
								</>
							)
						: view.total > 0 && (
								<>
									<TrashSearch view={view} />
									<TextButton variant="danger" onClick={actions.openEmpty}>
										{t("emptyAction")}
									</TextButton>
								</>
							)}
				</PageHeader>
				<TrashList view={view} actions={actions} now={now} />
				{panelItem && (
					<DockedPanel>
						<TrashPanel
							item={panelItem}
							now={now}
							onClose={view.closePanel}
							onRestore={() => void actions.restore([panelItem])}
							onDelete={() => void actions.requestDelete([panelItem])}
						/>
					</DockedPanel>
				)}
				<DeleteDialog actions={actions} />
				<EmptyDialog actions={actions} total={view.total} />
			</PageColumn>
		</AdminFrame>
	);
}
