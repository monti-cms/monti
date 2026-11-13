import type { KeyList, KeyRow, KeySlotRow, ModelList } from "@monti-cms/core";
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
import { Add, Edit, TrashCan } from "@monti-cms/ui/icons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { MODELS_ASK_AGAIN_MS } from "../../operations/models";
import { reasonOf, useOperation, useRead } from "../../operations/use-operation";
import { holdsKeyboardFocus, nextStop } from "../frame/focus-hand-off";
import { KeyWindow, type KeyWindowState, slotName } from "./key-dialog";

/** Tokens as the list writes them: as they are under a thousand, then in thousands, then in millions with two decimals ("812", "312K", "1.24M"). */
export function tokenAmount(tokens: number): string {
	if (tokens < 1000) return String(tokens);
	if (tokens < 1_000_000) return `${Math.round(tokens / 1000)}K`;
	return `${(tokens / 1_000_000).toFixed(2)}M`;
}

/** What the delete question is about: a key a person named, or the key in a plugin's slot. */
type Removing = { key: KeyRow } | { slot: KeySlotRow };

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
	// Opening the model menu asks the keys' services for their lists again, not more than once in a while (doc 10: the panel's model menu
	// does the same). The menu shows what is stored at once.
	const askModels = useOperation<ModelList>("models.list");
	const modelsAsked = useRef(0);
	const refreshModels = () => {
		const now = Date.now();
		if (now - modelsAsked.current < MODELS_ASK_AGAIN_MS) return;
		modelsAsked.current = now;
		void askModels.run({ refresh: true }).then((asked) => {
			if (asked.ok) void models.reload();
			else modelsAsked.current = 0;
		});
	};
	const remove = useOperation("keys.remove");
	const setSlot = useOperation("plugins.setKey");
	/** The key window: what it is open for, and whether it is open. It stays in the page while it fades out, and each opening is a new one (`nth`). */
	const [keyWindow, setKeyWindow] = useState<{ state: KeyWindowState; open: boolean; nth: number } | null>(null);
	const openWindow = (state: KeyWindowState) =>
		setKeyWindow((was) => ({ state, open: true, nth: (was?.nth ?? 0) + 1 }));
	/** The key the question is about, and whether the question is open: the key stays while the question closes, so its words do not empty. */
	const [removing, setRemoving] = useState<Removing | null>(null);
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
	const usageOf = (key: Pick<KeyRow, "readable" | "usage">): { text: string; tone: "subtle" | "faint" | "danger" } =>
		!key.readable
			? { text: t("apiKeys.unreadable"), tone: "danger" }
			: key.usage.tokens === 0
				? { text: t("apiKeys.unused"), tone: "faint" }
				: { text: t("apiKeys.usage", { amount: tokenAmount(key.usage.tokens) }), tone: "subtle" };

	// The plugins' slots are there only where a key can be stored: without the server's secret nothing can be put in one.
	// (A slot with a key in it stays on a site that cannot store keys, as the AI keys do: the key can still be removed.)
	const slots = (list.data?.slots ?? []).filter((slot) => canStore || slot.key !== null);
	/** Two lists on the page: each then says which it is. */
	const twoLists = slots.length > 0;
	const unreadable =
		keys.filter((key) => !key.readable).length + slots.filter((slot) => slot.key && !slot.key.readable).length;
	/** A row's id among the rows the focus moves between: a named key's id, or its slot. */
	const slotId = (slot: KeySlotRow) => `slot:${slot.plugin}/${slot.slot}`;
	const rowIds = [...keys.map((key) => key.id), ...slots.filter((slot) => slot.key).map(slotId)];
	/**
	 * The slot whose key was removed with the keyboard: its row stays, and once the list shows it empty the focus goes to its "enter key" button,
	 * which stands where the ⋯ that held the focus was.
	 */
	const emptied = useRef<string | null>(null);
	useEffect(() => {
		const id = emptied.current;
		if (id === null || !list.data) return;
		const slot = list.data.slots.find((each) => slotId(each) === id);
		if (slot?.key) return;
		emptied.current = null;
		rowEnds.current.get(id)?.querySelector("button")?.focus();
	});
	const ask = (what: Removing) => {
		beside.current = null;
		setRemoving(what);
		setAsking(true);
	};
	const table = (
		<Table container="none" aria-label={t("apiKeys.aiKeys")}>
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
										<RowMore label={t("apiKeys.more")} trigger={(button) => <DropdownMenuTrigger render={button} />} />
										<DropdownMenuContent align="end">
											{/* A site that cannot store keys cannot store a changed one either: it only removes. */}
											{canStore ? (
												<>
													<DropdownMenuItem onClick={() => openWindow({ mode: "edit", key })}>
														<Edit aria-hidden />
														{t("apiKeys.edit")}
													</DropdownMenuItem>
													<DropdownMenuSeparator />
												</>
											) : null}
											<DropdownMenuItem variant="danger" onClick={() => ask({ key })}>
												<TrashCan aria-hidden />
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
	);
	const aiKeys = keys.length === 0 ? canStore ? <Empty title={t("apiKeys.none")} /> : null : table;
	const quick = models.data?.quick ?? null;
	const quickKey = quick ? models.data?.keys.find((key) => key.id === quick.keyId) : undefined;

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
					<Stack gap={40} paddingTop={twoLists ? 32 : 0}>
						{/* No name over nothing: a site that cannot store keys and has no AI key shows no first list at all. */}
						{twoLists && aiKeys ? (
							<ListSection table title={t("apiKeys.aiKeys")}>
								{aiKeys}
							</ListSection>
						) : (
							aiKeys
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
												onOpenChange={(open) => {
													if (open) refreshModels();
												}}
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
						{/* A plugin's slot is a key row like the AI keys: the same window fills and changes it, its service already set. */}
						{twoLists ? (
							<ListSection table title={t("apiKeys.pluginKeys")}>
								<Table container="none" aria-label={t("apiKeys.pluginKeys")}>
									<TableBody>
										{slots.map((slot) => (
											<TableRow key={slotId(slot)} twoLine>
												<TableCell truncate>
													<Stack gap={4} minWidth={0}>
														<Inline gap={8} align="baseline">
															<Text truncate>{slot.pluginLabel}</Text>
															{slot.oneOfMany ? (
																<Text variant="note" tone="subtle">
																	{slot.label}
																</Text>
															) : null}
															{slot.key?.last4 ? (
																<Count>
																	{"··· "}
																	{slot.key.last4}
																</Count>
															) : null}
														</Inline>
														{slot.orphan ? (
															// No plugin of the site has the slot any more: nothing uses the key, and it is here to be removed.
															<Text as="div" variant="note" tone="faint" truncate>
																{t("apiKeys.noPlugin")}
															</Text>
														) : slot.key && !slot.key.readable ? (
															<Text as="div" variant="note" tone="danger" truncate>
																{t("apiKeys.unreadable")}
															</Text>
														) : (
															<Text as="div" variant="meta" mono tone="subtle" truncate>
																{slot.plugin}
															</Text>
														)}
													</Stack>
												</TableCell>
												<TableCell align="end">
													<RowActions
														ref={(node) => {
															if (node) rowEnds.current.set(slotId(slot), node);
															return () => void rowEnds.current.delete(slotId(slot));
														}}
													>
														{slot.key ? (
															<DropdownMenu>
																<RowMore
																	label={t("apiKeys.more")}
																	trigger={(button) => <DropdownMenuTrigger render={button} />}
																/>
																<DropdownMenuContent align="end">
																	{/* A key that cannot be stored again, or that no plugin has a slot for, is only removed. */}
																	{canStore && !slot.orphan ? (
																		<>
																			<DropdownMenuItem onClick={() => openWindow({ mode: "slot", slot })}>
																				<Edit aria-hidden />
																				{t("apiKeys.edit")}
																			</DropdownMenuItem>
																			<DropdownMenuSeparator />
																		</>
																	) : null}
																	<DropdownMenuItem variant="danger" onClick={() => ask({ slot })}>
																		<TrashCan aria-hidden />
																		{t("apiKeys.remove")}
																	</DropdownMenuItem>
																</DropdownMenuContent>
															</DropdownMenu>
														) : (
															<Button
																variant="ghost"
																size="sm"
																aria-label={t("apiKeys.slotAddFor", { name: slotName(slot) })}
																onClick={() => openWindow({ mode: "slot", slot })}
															>
																{t("apiKeys.slotAdd")}
															</Button>
														)}
													</RowActions>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
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
							{/* A slot's key is in use while a plugin has the slot: that plugin stops. */}
							{t(
								removing && ("slot" in removing ? !removing.slot.orphan : removing.key.uses.length > 0)
									? "apiKeys.removeTextInUse"
									: "apiKeys.removeText",
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{/* Which key, then what stops with it. */}
					{removing ? (
						<DescriptionList>
							<DescriptionItem label={t("apiKeys.name")}>
								{"slot" in removing ? slotName(removing.slot) : removing.key.name}
							</DescriptionItem>
							{"slot" in removing
								? null
								: removing.key.uses.map((use) => (
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
								if (!removing) return;
								const id = "slot" in removing ? slotId(removing.slot) : removing.key.id;
								// A press that held the keyboard's focus (the rule's one test, `holdsKeyboardFocus`): only that has a focus to hand on.
								const at = rowIds.indexOf(id);
								const byKeyboard = holdsKeyboardFocus(event.currentTarget);
								// A slot's row stays when its key goes (it turns to its "enter key" button): the focus stays on that row. A row that goes hands
								// the focus to the row after it, or before it.
								const stays = "slot" in removing && !removing.slot.orphan && canStore;
								emptied.current = byKeyboard && stays ? id : null;
								beside.current = !byKeyboard
									? null
									: stays
										? [id]
										: [rowIds[at + 1], rowIds[at - 1]].filter((each) => each !== undefined);
								setAsking(false);
								const sent =
									"slot" in removing
										? setSlot.run({ plugin: removing.slot.plugin, slot: removing.slot.slot, remove: true })
										: remove.run(
												{ id: removing.key.id },
												{ versions: { [`key:${removing.key.id}`]: removing.key.version } },
											);
								void sent.then((result) => {
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
