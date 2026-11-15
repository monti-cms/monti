import type { KeyList, KeyRow, KeySlotRow, ModelChoice, ModelList, ModelRole } from "@monti-cms/core";
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
	TableHead,
	TableHeader,
	TableRow,
	Text,
	toast,
} from "@monti-cms/ui";
import { Add, Edit, TrashCan } from "@monti-cms/ui/icons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { reasonText } from "../../assistant/failure";
import { useReloadModels } from "../../assistant/use-assistant";
import { useAdmin } from "../../operations/admin-context";
import { byName, MODELS_ASK_AGAIN_MS, modelName, modelTitle, seconds, tokenAmount } from "../../operations/models";
import { reasonOf, useOperation, useRead } from "../../operations/use-operation";
import { holdsKeyboardFocus, nextStop } from "../frame/focus-hand-off";
import { KeyWindow, type KeyWindowState, slotName } from "./key-dialog";

/** What the delete question is about: a key a person named, or the key in a plugin's slot. */
type Removing = { key: KeyRow } | { slot: KeySlotRow };

/** A model as the model menu names it: its key and its id, in one value. */
const choice = (keyId: string, model: string) => JSON.stringify([keyId, model]);

/** The column names over a list of keys (UX-03), and an empty one over the rows' ⋯. */
function KeysHead({ columns }: { columns: readonly string[] }) {
	return (
		<TableHeader>
			<TableRow>
				{columns.map((name) => (
					<TableHead key={name} scope="col">
						{name}
					</TableHead>
				))}
				<TableHead aria-hidden />
			</TableRow>
		</TableHeader>
	);
}

/** The two jobs this screen picks a model for, in the order their rows stand: a new conversation's, then the quick tasks'. */
const ROLES: readonly ModelRole[] = ["assistant", "quick"];

/** What `models.choose` answers: the model picked, and how long its trial answer took (`null`: the site has nothing that tries models). */
type Chosen = { output: ModelChoice & { for: ModelRole; ms: number | null } };

/**
 * Tools › API keys (tools.md, doc 14). The service keys are a list as the templates tab beside it draws its own: rows of the shared table under
 * their column names (UX-03), each with the key's last four characters after its name, the tokens it used this month in its own column, and edit
 * and delete in its ⋯. Under the list, the two models this screen picks (a new conversation's and the quick tasks'): settings, not a list. A model
 * is tried once before it is picked. The key itself is on the screen only while it is typed.
 */
export function KeysScreen({ tabs }: { tabs: ReactNode }) {
	const { t } = useAdmin();
	const list = useRead<KeyList>("keys.list");
	const models = useRead<ModelList>("models.list");
	const choose = useOperation<Chosen>("models.choose");
	// The assistant's panel keeps the site's models too: a new conversation starts on the one picked here.
	const reloadAssistant = useReloadModels();
	/** The model being tried for each job: its field shows it, and cannot be pressed, until the trial ends. */
	const [trying, setTrying] = useState<Partial<Record<ModelRole, ModelChoice>>>({});
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
	/** What a key used this month: the tokens Monti counted. */
	const usageOf = (key: Pick<KeyRow, "readable" | "usage">): { text: string; tone: "subtle" | "faint" | "danger" } => {
		if (!key.readable) return { text: t("apiKeys.unreadable"), tone: "danger" };
		return key.usage.tokens === 0
			? { text: t("apiKeys.unused"), tone: "faint" }
			: { text: t("apiKeys.usage", { amount: tokenAmount(key.usage.tokens) }), tone: "subtle" };
	};

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
			<KeysHead columns={[t("apiKeys.column.key"), t("apiKeys.column.month")]} />
			<TableBody>
				{keys.map((key) => {
					const usage = usageOf(key);
					return (
						<TableRow key={key.id} twoLine>
							<TableCell truncate>
								<Inline gap={8} align="baseline">
									<Text truncate tone={usage.tone === "faint" ? "muted" : "default"}>
										{key.name}
									</Text>
									{key.last4 ? (
										<Count>
											{"…"}
											{key.last4}
										</Count>
									) : null}
								</Inline>
							</TableCell>
							<TableCell>
								<Text variant="note" tone={usage.tone}>
									{usage.text}
								</Text>
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

	/** Tries a model for a job and, when it answers, makes it the site's: the toast says how long the answer took, or why there was none. */
	const pick = (role: ModelRole, picked: ModelChoice) => {
		setTrying((was) => ({ ...was, [role]: picked }));
		void choose.run({ for: role, ...picked }).then(async (result) => {
			if (result.ok) {
				const ms = result.body.output.ms;
				toast(ms === null ? t(`apiKeys.changed.${role}`) : t(`apiKeys.chosen.${role}`, { seconds: seconds(ms) }));
				reloadAssistant();
				// The field keeps the model tried until the list says it is the one: it does not flick back to the one before.
				await models.reload();
			} else {
				// The key changed while its model answered (another person changed it): the list is read again.
				const conflict = result.refusal.error === "conflict";
				toast.error(
					t("apiKeys.notChosen", {
						why: conflict ? t("errors.savedElsewhere") : reasonText(t, reasonOf(result.refusal)),
					}),
				);
				if (conflict) await Promise.all([list.reload(), models.reload()]);
			}
			setTrying(({ [role]: _done, ...rest }) => rest);
		});
	};
	/** A job's row: its model in a field that opens the models of every key, tried before it is picked. */
	const modelRow = (role: ModelRole, listed: ModelList) => {
		const labelId = `keys-${role}-model`;
		const tried = trying[role];
		const shown = tried ?? listed[role];
		const key = shown ? listed.keys.find((each) => each.id === shown.keyId) : undefined;
		const model = key?.models.find((each) => each.id === shown?.model);
		return (
			<ListSectionRow
				key={role}
				title={t(role === "assistant" ? "apiKeys.assistant" : "apiKeys.quick")}
				labelId={labelId}
				meta={t(role === "assistant" ? "apiKeys.assistantFor" : "apiKeys.quickFor")}
				control={
					shown && key ? (
						<ModelMenu
							layout="field"
							onOpenChange={(open) => {
								if (open) refreshModels();
							}}
							value={choice(shown.keyId, shown.model)}
							onValueChange={(value) => {
								// One trial at a time for a job: a pick while one runs is not taken.
								if (tried) return;
								const [keyId, id] = JSON.parse(value) as [string, string];
								pick(role, { keyId, model: id });
							}}
							groups={listed.keys.map((each) => ({
								key: each.id,
								label: each.name,
								count: each.models.length,
								items: byName(each.models).map((m) => ({
									value: choice(each.id, m.id),
									model: modelName(m),
									id: m.id,
									title: modelTitle(t, m),
								})),
							}))}
							searchLabel={t("apiKeys.findModel")}
							emptyText={t("apiKeys.noModel")}
							trigger={
								<MenuField
									aria-labelledby={labelId}
									size="default"
									// Not disabled while its model is tried: the menu gives the focus back to it as it closes, and a disabled
									// button would drop it to the page.
									aria-busy={tried !== undefined || undefined}
									value={model ? modelName(model) : shown.model}
									meta={tried ? t("apiKeys.trying") : key.name}
								/>
							}
						/>
					) : (
						// No key gives a model yet: the field opens the way to add one.
						<MenuField
							aria-labelledby={labelId}
							size="default"
							placeholder={t("apiKeys.noKey")}
							onClick={() => openWindow({ mode: "pick" })}
						/>
					)
				}
			/>
		);
	};

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
						{/* The two models this screen picks; the choices come from the keys above. */}
						{canStore && models.data ? (
							<ListSection title={t("apiKeys.models")}>
								{ROLES.map((role) => (models.data ? modelRow(role, models.data) : null))}
							</ListSection>
						) : null}
						{/* A plugin's slot is a key row like the AI keys: the same window fills and changes it, its service already set. */}
						{twoLists ? (
							<ListSection table title={t("apiKeys.pluginKeys")}>
								<Table container="none" aria-label={t("apiKeys.pluginKeys")}>
									{/* A plugin's key has no use of its own to count: its one column is the key. */}
									<KeysHead columns={[t("apiKeys.column.key")]} />
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
																	{"…"}
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
											t(result.refusal.error === "conflict" ? "errors.savedElsewhere" : reasonOf(result.refusal)),
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
