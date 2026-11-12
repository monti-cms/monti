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
import { type ReactNode, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";
import { KeyDialog, type KeyDialogState, ServiceDialog } from "./key-dialog";

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
 * the key's last four characters after its name, its use this month under it, and "편집 · 지우기" in its ⋯. Under the list, the one model this
 * screen picks (the quick tasks'): a setting, not a list. The key itself is on the screen only while it is typed.
 */
export function KeysScreen({ tabs }: { tabs: ReactNode }) {
	const { t } = useAdmin();
	const list = useRead<KeyList>("keys.list", {}, { afterWrites: true });
	const models = useRead<ModelList>("models.list", {}, { afterWrites: true });
	const setQuick = useOperation("models.setQuick");
	const remove = useOperation("keys.remove");
	const [picking, setPicking] = useState(false);
	const [dialog, setDialog] = useState<KeyDialogState | null>(null);
	/** The key the question is about, and whether the question is open: the key stays while the question closes, so its words do not empty. */
	const [removing, setRemoving] = useState<KeyRow | null>(null);
	const [asking, setAsking] = useState(false);

	const keys = list.data?.keys ?? [];
	const canStore = list.data?.canStore ?? true;
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
			<PageHeader title={t("tools.title")}>
				{canStore ? (
					<Button variant="primary" onClick={() => setPicking(true)}>
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
													<RowActions>
														<DropdownMenu>
															<RowMore
																label={t("apiKeys.more", { name: key.name })}
																trigger={(button) => <DropdownMenuTrigger render={button} />}
															/>
															<DropdownMenuContent align="end">
																{/* A site that cannot store keys cannot store a changed one either: it only removes. */}
																{canStore ? (
																	<>
																		<DropdownMenuItem onClick={() => setDialog({ mode: "edit", key })}>
																			{t("apiKeys.edit")}
																		</DropdownMenuItem>
																		<DropdownMenuSeparator />
																	</>
																) : null}
																<DropdownMenuItem
																	variant="danger"
																	onClick={() => {
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
														else toast.error(t(result.refusal.reason ?? "errors.unexpected"));
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
												onClick={() => setPicking(true)}
											/>
										)
									}
								/>
							</ListSection>
						) : null}
					</Stack>
				</PageBody>
			) : null}

			<ServiceDialog
				open={picking}
				services={list.data?.services ?? []}
				onClose={() => setPicking(false)}
				onPick={(service) => {
					setPicking(false);
					setDialog({ mode: "add", service });
				}}
			/>
			{dialog ? (
				<KeyDialog
					key={dialog.mode === "add" ? `add:${dialog.service}` : `edit:${dialog.key.id}`}
					state={dialog}
					services={list.data?.services ?? []}
					names={keys.map((key) => key.name)}
					onClose={() => setDialog(null)}
					onStale={() => void list.reload()}
				/>
			) : null}
			<AlertDialog open={asking} onOpenChange={setAsking}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("apiKeys.removeTitle", { name: removing?.name ?? "" })}</AlertDialogTitle>
						<AlertDialogDescription>
							{removing && removing.uses.length > 0
								? `${t("apiKeys.removeText")} ${t("apiKeys.removeStops")}`
								: t("apiKeys.removeText")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{removing && removing.uses.length > 0 ? (
						<DescriptionList>
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
							onClick={() => {
								const key = removing;
								if (!key) return;
								setAsking(false);
								void remove.run({ id: key.id }, { versions: { [`key:${key.id}`]: key.version } }).then((result) => {
									if (result.ok) toast(t("apiKeys.removed"));
									else {
										toast.error(t(result.refusal.reason ?? "apiKeys.conflict"));
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
