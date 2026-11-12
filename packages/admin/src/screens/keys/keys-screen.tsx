import type { KeyList, KeyRow, ModelList } from "@monti-cms/core";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Banner,
	Button,
	Count,
	DescriptionItem,
	DescriptionList,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Empty,
	Inline,
	ListSection,
	ListSectionRow,
	MenuField,
	ModelMenu,
	PageBanner,
	PageBody,
	PageColumn,
	PageHeader,
	RowActions,
	RowMore,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	toast,
} from "@monti-cms/ui";
import { Add } from "@monti-cms/ui/icons";
import { type ReactNode, useRef, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useOperation, useRead } from "../../operations/use-operation";
import { nextStop } from "../frame/focus-hand-off";
import { KeyWindow, type KeyWindowState } from "./key-dialog";

/** Tokens as the list writes them: as they are under a thousand, then in thousands, then in millions with two decimals ("812", "312K", "1.24M"). */
export function tokenAmount(tokens: number): string {
	if (tokens < 1000) return String(tokens);
	if (tokens < 1_000_000) return `${Math.round(tokens / 1000)}K`;
	return `${(tokens / 1_000_000).toFixed(2)}M`;
}

/** A model as the model menu names it: its key and its id, in one value. */
const choice = (keyId: string, model: string) => JSON.stringify([keyId, model]);

/**
 * Tools › API keys (tools.md, doc 14). The service keys are a list as the templates tab beside it draws its own: rows of the shared table, each with
 * the key's last four characters after its name, its use this month under it, and edit and delete in its ⋯. Under the list, the one model this
 * screen picks (the quick tasks'): a setting, not a list. The key itself is on the screen only while it is typed.
 */
export function KeysScreen({ tabs }: { tabs: ReactNode }) {
	const { t } = useAdmin();
	const list = useRead<KeyList>("keys.list", {}, { afterWrites: true });
	const models = useRead<ModelList>("models.list", {}, { afterWrites: true });
	const setQuick = useOperation("models.setQuick");
	const remove = useOperation("keys.remove");
	/** The key window: what it is open for, and whether it is open. It stays in the page while it fades out, and each opening is a new one (`nth`). */
	const [keyWindow, setKeyWindow] = useState<{ state: KeyWindowState; open: boolean; nth: number } | null>(null);
	const openWindow = (state: KeyWindowState) =>
		setKeyWindow((was) => ({ state, open: true, nth: (was?.nth ?? 0) + 1 }));
	/** The key the question is about, and whether the question is open: the key stays while the question closes, so its words do not empty. */
	const [removing, setRemoving] = useState<KeyRow | null>(null);
	const [asking, setAsking] = useState(false);
	/** The page's head, and each row's end by its key: where the focus can go when a row is gone. */
	const header = useRef<HTMLElement>(null);
	const rowEnds = useRef(new Map<string, HTMLElement>());
	/**
	 * The rows beside the one being removed with the keyboard, the one after it first: the question closes before the row goes, and the focus
	 * given back to that row's ⋯ would fall to the page with it (tokens.md, the states). Nothing for a pointer's press, which holds no focus.
	 */
	const beside = useRef<string[] | null>(null);
	const afterRemove = () => {
		if (!beside.current) return null;
		for (const id of beside.current) {
			const more = rowEnds.current.get(id)?.querySelector("button");
			if (more) return more;
		}
		// No row left: the way to add one, or on a site that cannot store keys the page's first control, its tab.
		const head = header.current;
		return head ? (head.querySelector("button") ?? nextStop(head)) : null;
	};

	const keys = list.data?.keys ?? [];
	// Nothing that depends on the list is drawn before it is read: a site that cannot store keys never shows the way to add one.
	const canStore = list.data?.canStore ?? false;
	const unreadable = keys.filter((key) => !key.readable).length;
	const quick = models.data?.quick ?? null;
	const quickKey = quick ? models.data?.keys.find((key) => key.id === quick.keyId) : undefined;

	const usageOf = (key: KeyRow): { text: string; tone: "subtle" | "faint" | "danger" } =>
		!key.readable
			? { text: t("apiKeys.unreadable"), tone: "danger" }
			: key.usage.tokens === 0
				? { text: t("apiKeys.unused"), tone: "faint" }
				: { text: t("apiKeys.usage", { amount: tokenAmount(key.usage.tokens) }), tone: "subtle" };

	return (
		<PageColumn width="content">
			{/* One banner, at the very top: why no key can be stored, or how many can no longer be read. */}
			<PageBanner>
				{list.data && !canStore ? (
					<Banner title={t("apiKeys.banner.noSecret")} meta={t("apiKeys.banner.noSecretMeta")} />
				) : unreadable > 0 ? (
					<Banner
						title={t("apiKeys.banner.unreadable", { count: unreadable })}
						meta={t("apiKeys.banner.unreadableMeta")}
					/>
				) : null}
			</PageBanner>
			<PageHeader ref={header} title={t("tools.title")}>
				{canStore ? (
					<Button variant="primary" onClick={() => openWindow({ mode: "pick" })}>
						<Add aria-hidden />
						{t("apiKeys.add")}
					</Button>
				) : null}
			</PageHeader>
			{tabs}
			{list.data ? (
				<PageBody>
					<Stack gap={40}>
						{keys.length === 0 ? (
							canStore ? (
								<Empty title={t("apiKeys.none")} />
							) : null
						) : (
							<Table container="none" aria-label={t("tools.keys")}>
								<TableBody>
									{keys.map((key) => {
										const usage = usageOf(key);
										return (
											<TableRow key={key.id} twoLine>
												<TableCell truncate>
													<Stack gap={4} minWidth={0}>
														<Inline gap={8} align="baseline">
															<Text truncate tone={usage.tone === "faint" ? "muted" : "default"}>
																{key.name}
															</Text>
															{key.last4 ? (
																<Count>
																	{"··· "}
																	{key.last4}
																</Count>
															) : null}
														</Inline>
														<Text as="div" variant="note" tone={usage.tone} truncate>
															{usage.text}
														</Text>
													</Stack>
												</TableCell>
												<TableCell align="end">
													<RowActions
														ref={(node) => {
															if (node) rowEnds.current.set(key.id, node);
															return () => void rowEnds.current.delete(key.id);
														}}
													>
														<DropdownMenu>
															<RowMore
																label={t("apiKeys.more", { name: key.name })}
																trigger={(button) => <DropdownMenuTrigger render={button} />}
															/>
															<DropdownMenuContent align="end">
																{/* A site that cannot store keys cannot store a changed one either: it only removes. */}
																{canStore ? (
																	<>
																		<DropdownMenuItem onClick={() => openWindow({ mode: "edit", key })}>
																			{t("apiKeys.edit")}
																		</DropdownMenuItem>
																		<DropdownMenuSeparator />
																	</>
																) : null}
																<DropdownMenuItem
																	variant="danger"
																	onClick={() => {
																		beside.current = null;
																		setRemoving(key);
																		setAsking(true);
																	}}
																>
																	{t("apiKeys.remove")}
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</RowActions>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						)}
						{/* The one model this screen picks; the choices come from the keys above. */}
						{canStore && models.data ? (
							<ListSection title={t("apiKeys.models")}>
								<ListSectionRow
									title={t("apiKeys.quick")}
									labelId="keys-quick-model"
									meta={t("apiKeys.quickFor")}
									control={
										quick && quickKey ? (
											<ModelMenu
												layout="field"
												value={choice(quick.keyId, quick.model)}
												onValueChange={(value) => {
													const [keyId, model] = JSON.parse(value) as [string, string];
													void setQuick.run({ keyId, model }).then((result) => {
														if (result.ok) toast(t("apiKeys.quickChanged"));
														else toast.error(t(reasonOf(result.refusal)));
													});
												}}
												groups={models.data.keys.map((key) => ({
													key: key.id,
													label: key.name,
													count: key.models.length,
													items: key.models.map((model) => ({ value: choice(key.id, model.id), model: model.id })),
												}))}
												searchLabel={t("apiKeys.findModel")}
												emptyText={t("apiKeys.noModel")}
												trigger={
													<MenuField
														aria-labelledby="keys-quick-model"
														size="default"
														mono
														value={quick.model}
														meta={quickKey.name}
													/>
												}
											/>
										) : (
											// No key gives a model yet: the field opens the way to add one.
											<MenuField
												aria-labelledby="keys-quick-model"
												size="default"
												placeholder={t("apiKeys.noKey")}
												onClick={() => openWindow({ mode: "pick" })}
											/>
										)
									}
								/>
							</ListSection>
						) : null}
					</Stack>
				</PageBody>
			) : null}

			{keyWindow ? (
				<KeyWindow
					state={keyWindow.state}
					open={keyWindow.open}
					nth={keyWindow.nth}
					services={list.data?.services ?? []}
					names={keys.map((key) => key.name)}
					onPick={(service) => setKeyWindow((was) => was && { ...was, state: { mode: "add", service } })}
					// Each closes the opening it names: an answer that comes for a window closed earlier leaves the one opened since alone.
					onClose={(nth) => setKeyWindow((was) => (was && was.nth === nth ? { ...was, open: false } : was))}
					// Out of the page once its fade is over, unless it was opened again meanwhile.
					onClosed={(nth) => setKeyWindow((was) => (was && was.nth === nth && !was.open ? null : was))}
					onStale={() => void list.reload()}
				/>
			) : null}
			<AlertDialog open={asking} onOpenChange={setAsking}>
				{/* Closed without removing, or with a pointer: the focus goes back to the row's ⋯, the part's own way. */}
				<AlertDialogContent finalFocus={afterRemove}>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("apiKeys.removeTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t(removing && removing.uses.length > 0 ? "apiKeys.removeTextInUse" : "apiKeys.removeText")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{/* Which key, then what stops with it. */}
					{removing ? (
						<DescriptionList>
							<DescriptionItem label={t("apiKeys.name")}>{removing.name}</DescriptionItem>
							{removing.uses.map((use) => (
								<DescriptionItem key={use.for} label={t(`apiKeys.use.${use.for}`)} mono>
									{use.model}
								</DescriptionItem>
							))}
						</DescriptionList>
					) : null}
					<AlertDialogFooter>
						<AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							variant="danger"
							onClick={(event) => {
								const key = removing;
								if (!key) return;
								// A click made with the keyboard counts no presses of a pointer (`detail` 0): only that has a focus to hand on.
								const at = keys.findIndex((each) => each.id === key.id);
								beside.current =
									event.detail === 0 ? [keys[at + 1]?.id, keys[at - 1]?.id].filter((id) => id !== undefined) : null;
								setAsking(false);
								void remove.run({ id: key.id }, { versions: { [`key:${key.id}`]: key.version } }).then((result) => {
									if (result.ok) toast(t("apiKeys.removed"));
									else {
										// Only a key that changed since the list was read is "saved elsewhere"; anything else says what it was.
										toast.error(
											t(result.refusal.error === "conflict" ? "ui.savedElsewhere" : reasonOf(result.refusal)),
										);
										void list.reload();
									}
								});
							}}
						>
							{t("apiKeys.remove")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageColumn>
	);
}
