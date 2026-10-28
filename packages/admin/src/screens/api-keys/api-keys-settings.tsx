"use client";

import { Add, Edit, Plug, Renew, TrashCan } from "@carbon/icons-react";
import { type ApiKeyList, type ApiKeySlotView, type ApiKeyView, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Banner,
	Box,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFormFooter,
	DialogHeader,
	DialogTitle,
	FormFieldError,
	Inline,
	Input,
	List,
	ListItem,
	Stack,
	Text,
} from "@monti-cms/ui";
import { type ReactNode, useId, useState } from "react";
import { apiKeysKeys, createApiKey, deleteApiKey, putApiKeySlot, updateApiKey, useApiKeys } from "../../api/api-keys";
import { errorText } from "../../api/client";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { commonMessages } from "../../lib/common.messages";
import { type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { useConfirm } from "../shared/confirm-dialog";
import { EmptyState } from "../shared/empty-state";
import { Labeled } from "../shared/labeled";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { ToolsFrame } from "../tools/tools-frame";
import { type ApiKeyChoice, ApiKeyField, choiceReady } from "./api-key-field";
import { apiKeysMessages } from "./messages";

type Editing = { mode: "add" } | { mode: "rename" | "replace"; key: ApiKeyView };

/** The API keys page: one card with a row per key, the one primary action ("Add key") in the page header, and the dialogs to add, rename, replace and delete. */
export function ApiKeysSettings() {
	const t = useTranslator(apiKeysMessages);
	const query = useApiKeys();
	const [editing, setEditing] = useState<Editing | null>(null);
	const [slotEditing, setSlotEditing] = useState<ApiKeySlotView | null>(null);
	const { confirm, dialog } = useConfirm();
	const remove = useCmsMutation({
		fn: (key: ApiKeyView, { site }) =>
			deleteApiKey(site, key, { force: key.uses.length > 0, fallback: t("error.delete") }),
		success: t("toast.deleted"),
		failure: t("error.delete"),
		invalidate: [apiKeysKeys.all],
	});
	const clearSlot = useCmsMutation({
		fn: ({ plugin, slot }: { plugin: string; slot: string; label: string }, { site }) =>
			putApiKeySlot(site, plugin, slot, { use: "none" }, t("error.save")),
		success: (_result, { label }) => t("toast.slotCleared", { label }),
		failure: t("error.save"),
		invalidate: [apiKeysKeys.all],
	});
	const list: ApiKeyList | undefined = query.data;

	const askDelete = async (key: ApiKeyView) => {
		const used = key.uses.length > 0;
		const ok = await confirm({
			title: t("delete.title", { name: key.name }),
			description: used ? (
				<Stack gap={8}>
					<Text as="p">{t("delete.usedDescription", { count: key.uses.length })}</Text>
					<List data-testid="delete-dependents">
						{key.uses.map((use) => (
							<ListItem key={`${use.plugin}:${use.ref}`}>{use.label}</ListItem>
						))}
					</List>
				</Stack>
			) : (
				t("delete.unusedDescription")
			),
			confirmLabel: t("delete.confirm"),
			destructive: true,
		});
		// A failure is toasted by the mutation.
		if (ok) await remove.mutateAsync(key).catch(() => {});
	};

	const rowMenu = (key: ApiKeyView): MenuAction[] => [
		{ kind: "item", label: t("menu.rename"), icon: Edit, onSelect: () => setEditing({ mode: "rename", key }) },
		{ kind: "item", label: t("menu.replace"), icon: Renew, onSelect: () => setEditing({ mode: "replace", key }) },
		...key.slots.map(
			(use): MenuAction => ({
				kind: "item",
				label: t("menu.clearSlot", { label: use.label }),
				icon: Plug,
				onSelect: () => clearSlot.mutate({ plugin: use.plugin, slot: use.ref, label: use.label }),
			}),
		),
		{ kind: "separator" },
		{ kind: "item", label: t("menu.delete"), icon: TrashCan, destructive: true, onSelect: () => askDelete(key) },
	];

	return (
		<ToolsFrame
			tab="api-keys"
			wide
			actions={
				<Button type="button" disabled={!list?.secretsAvailable} onClick={() => setEditing({ mode: "add" })}>
					<Add aria-hidden />
					{t("add")}
				</Button>
			}
		>
			<Stack gap={0} grow minHeight={0} overflow="y" data-testid="api-keys-settings">
				{list && !list.secretsAvailable && <Banner role="alert" title={t("secret.description")} />}
				<Inline border="y" paddingX={32} paddingY={8} shrink={false}>
					<Text variant="caption" tone="muted">
						{list
							? [
									t("count.keys", { count: list.items.length }),
									...(list.slots.some((slot) => !slot.key)
										? [t("count.needed", { count: list.slots.filter((slot) => !slot.key).length })]
										: []),
								].join(" · ")
							: "\u00a0"}
					</Text>
				</Inline>
				<KeyRows
					query={query}
					menu={rowMenu}
					onAssign={setSlotEditing}
					onRetry={() => void query.refetch()}
					onAdd={() => setEditing({ mode: "add" })}
				/>
				<Box paddingX={32} paddingY={16}>
					<Text as="p" variant="caption" tone="muted">
						{t("note")}
					</Text>
				</Box>
				{editing && (
					<KeyDialog
						key={editing.mode === "add" ? "add" : `${editing.mode}:${editing.key.id}`}
						editing={editing}
						taken={(list?.items ?? []).filter((item) => editing.mode === "add" || item.id !== editing.key.id)}
						onClose={() => setEditing(null)}
					/>
				)}
				{slotEditing && (
					<SlotDialog
						key={`${slotEditing.plugin}:${slotEditing.slot}`}
						slot={slotEditing}
						onClose={() => setSlotEditing(null)}
					/>
				)}
				{dialog}
			</Stack>
		</ToolsFrame>
	);
}

function KeyRows({
	query,
	menu,
	onAssign,
	onRetry,
	onAdd,
}: {
	query: ReturnType<typeof useApiKeys>;
	menu: (key: ApiKeyView) => MenuAction[];
	onAssign: (slot: ApiKeySlotView) => void;
	onRetry: () => void;
	onAdd: () => void;
}) {
	const t = useTranslator(apiKeysMessages);
	const tc = useTranslator(commonMessages);
	const site = useSite();
	const list = query.data;
	if (!list) {
		if (query.error) {
			return (
				<Box paddingX={32} paddingY={12}>
					<LoadErrorAlert message={errorText(site, query.error, t("load.failed"))} onRetry={onRetry} />
				</Box>
			);
		}
		return (
			<Box paddingX={32} paddingY={16}>
				<Text as="p" variant="note" tone="subtle" role="status">
					{tc("loading")}
				</Text>
			</Box>
		);
	}
	const emptySlots = list.slots.filter((slot) => !slot.key);
	if (list.items.length === 0 && list.slots.length === 0) {
		return (
			<Box paddingX={32}>
				<EmptyState
					title={t("empty.title")}
					description={t("empty.description")}
					action={{ label: t("add"), onClick: onAdd, disabled: !list.secretsAvailable }}
				/>
			</Box>
		);
	}
	return (
		<Stack as="ul" gap={0} border="bottom" aria-label={t("title")}>
			{list.items.map((key) => (
				<Inline
					as="li"
					key={key.id}
					gap={12}
					paddingX={32}
					paddingY={12}
					border="top"
					data-testid={`api-key-${key.name}`}
				>
					<Stack gap={2} grow minWidth={0}>
						<Inline gap={8}>
							<Text weight="medium" truncate>
								{key.name}
							</Text>
							{!key.readable && (
								<Text variant="meta" tone="danger" title={t("row.unreadableHint")}>
									{t("row.unreadable")}
								</Text>
							)}
						</Inline>
						{!key.readable ? (
							<Text as="p" variant="caption" tone="muted" truncate>
								{t("row.unreadableHint")}
							</Text>
						) : key.uses.length > 0 ? (
							<Inline as="ul" aria-label={t("row.usedBy")} gap={4} wrap paddingTop={8}>
								{key.uses.map((use) => (
									<Box
										as="li"
										key={`${use.plugin}:${use.ref}`}
										background="selected"
										radius="sm"
										paddingX={8}
										paddingY={2}
									>
										<Text variant="caption" weight="medium">
											{use.label}
										</Text>
									</Box>
								))}
							</Inline>
						) : (
							<Text as="p" variant="caption" tone="muted" truncate>
								{t("row.unused")}
							</Text>
						)}
					</Stack>
					<Text
						variant="caption"
						tone="muted"
						mono
						title={key.tail ? t("row.mask", { tail: key.tail }) : t("row.maskShort")}
					>
						{"••••"}
						{key.tail}
					</Text>
					<MoreActionsButton label={t("row.menu", { name: key.name })} actions={menu(key)} />
				</Inline>
			))}
			{emptySlots.map((slot) => (
				<Inline
					as="li"
					key={`${slot.plugin}:${slot.slot}`}
					gap={12}
					paddingX={32}
					paddingY={12}
					border="top"
					data-testid={`api-key-slot-${slot.plugin}-${slot.slot}`}
				>
					<Inline gap={8} grow minWidth={0}>
						<Text weight="medium" truncate>
							{slot.label}
						</Text>
						<Text variant="caption" tone="muted">
							{t("slot.empty")}
						</Text>
					</Inline>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						disabled={!list.secretsAvailable}
						onClick={() => onAssign(slot)}
					>
						{t("slot.assign")}
					</Button>
				</Inline>
			))}
		</Stack>
	);
}

/** Pick a saved key or enter a new one for a plugin's key slot; a typed key is saved together with the assignment. */
function SlotDialog({ slot, onClose }: { slot: ApiKeySlotView; onClose: () => void }) {
	const t = useTranslator(apiKeysMessages);
	const site = useSite();
	const query = useApiKeys();
	const hasKeys = (query.data?.items.length ?? 0) > 0;
	const [choice, setChoice] = useState<ApiKeyChoice | null>(null);
	const current: ApiKeyChoice =
		choice ?? (hasKeys ? { use: "saved", keyId: query.data?.items[0]?.id ?? "" } : { use: "new", value: "" });
	const [error, setError] = useState<string | null>(null);
	const assign = useCmsMutation({
		fn: (choice: ApiKeyChoice, { site }) => putApiKeySlot(site, slot.plugin, slot.slot, choice, t("error.save")),
		success: t("toast.slotAssigned"),
		failure: t("error.save"),
		inline: true,
		invalidate: [apiKeysKeys.all],
		onSuccess: onClose,
		onError: (saveError) => setError(errorText(site, saveError, t("error.save"))),
	});
	const saving = assign.isPending;
	const save = () => {
		setError(null);
		assign.mutate(current);
	};
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent data-testid="api-key-slot-dialog">
				<Stack
					as="form"
					gap={16}
					onSubmit={(event) => {
						event.preventDefault();
						void save();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t("slot.dialog.title", { label: slot.label })}</DialogTitle>
						<DialogDescription>{t("slot.dialog.description")}</DialogDescription>
					</DialogHeader>
					<ApiKeyField value={current} onChange={setChoice} baseName={slot.service} />
					{error && <FormFieldError>{error}</FormFieldError>}
					<DialogFormFooter
						onCancel={onClose}
						busy={saving}
						disabled={!choiceReady(current)}
						submitLabel={t("slot.dialog.confirm")}
					/>
				</Stack>
			</DialogContent>
		</Dialog>
	);
}

function KeyDialog({
	editing,
	taken,
	onClose,
}: {
	editing: Editing;
	taken: readonly ApiKeyView[];
	onClose: () => void;
}) {
	const t = useTranslator(apiKeysMessages);
	const site = useSite();
	const nameId = useId();
	const valueId = useId();
	const key = editing.mode === "add" ? null : editing.key;
	const [name, setName] = useState(key?.name ?? "");
	const [value, setValue] = useState("");
	const [error, setError] = useState<string | null>(null);
	const needsName = editing.mode !== "replace";
	const needsValue = editing.mode !== "rename";
	const nameTaken = needsName && taken.some((item) => item.name.toLowerCase() === name.trim().toLowerCase());
	const ready = (!needsName || (name.trim() !== "" && !nameTaken)) && (!needsValue || value.trim() !== "");

	const saveKey = useCmsMutation({
		// biome-ignore lint/suspicious/noConfusingVoidType: a mutation without variables, so `mutate()` takes no argument
		fn: (_: void, { site }) => {
			if (!key) return createApiKey(site, { name: name.trim(), value: value.trim() }, t("error.save"));
			return updateApiKey(
				site,
				key.id,
				{
					expectedVersion: key.version,
					...(editing.mode === "rename" ? { name: name.trim() } : { value: value.trim() }),
				},
				t("error.save"),
			);
		},
		success: t(editing.mode === "add" ? "toast.added" : editing.mode === "rename" ? "toast.renamed" : "toast.replaced"),
		failure: t("error.save"),
		inline: true,
		// A failed save can mean the key changed meanwhile, so the list is refetched either way.
		invalidate: [apiKeysKeys.all],
		onSuccess: onClose,
		onError: (saveError) => setError(errorText(site, saveError, t("error.save"))),
	});
	const saving = saveKey.isPending;

	const save = () => {
		if (!ready || saving) return;
		setError(null);
		saveKey.mutate();
	};

	const title =
		editing.mode === "add"
			? t("dialog.add.title")
			: editing.mode === "rename"
				? t("dialog.rename.title")
				: t("dialog.replace.title", { name: editing.key.name });
	const description: ReactNode =
		editing.mode === "add"
			? t("dialog.add.description")
			: editing.mode === "rename"
				? t("dialog.rename.description")
				: t("dialog.replace.description");
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent data-testid="api-key-dialog">
				<Stack
					as="form"
					gap={16}
					onSubmit={(event) => {
						event.preventDefault();
						void save();
					}}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					{needsName && (
						<Labeled label={t("field.name")} htmlFor={nameId}>
							<Input
								id={nameId}
								value={name}
								autoComplete="off"
								placeholder={t("field.namePlaceholder")}
								aria-invalid={nameTaken ? true : undefined}
								onChange={(event) => setName(event.target.value)}
							/>
							{nameTaken && <FormFieldError>{t("field.nameTaken")}</FormFieldError>}
						</Labeled>
					)}
					{needsValue && (
						<Labeled label={t("field.value")} htmlFor={valueId}>
							<Input
								id={valueId}
								type="password"
								autoComplete="off"
								mono
								value={value}
								placeholder={t("field.valuePlaceholder")}
								onChange={(event) => setValue(event.target.value)}
							/>
						</Labeled>
					)}
					{error && <FormFieldError>{error}</FormFieldError>}
					<DialogFormFooter
						onCancel={onClose}
						busy={saving}
						disabled={!ready}
						submitLabel={t(
							editing.mode === "add"
								? "dialog.add.confirm"
								: editing.mode === "rename"
									? "dialog.rename.confirm"
									: "dialog.replace.confirm",
						)}
					/>
				</Stack>
			</DialogContent>
		</Dialog>
	);
}
