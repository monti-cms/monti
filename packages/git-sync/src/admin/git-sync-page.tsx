"use client";

import { adminApiUrl, errorText, useCmsMutation, useSite, useTranslator } from "@monti-cms/admin";
import {
	Alert,
	AlertDescription,
	type ApiKeyChoice,
	ApiKeyField,
	apiKeysKeys,
	Badge,
	Box,
	Button,
	choiceReady,
	commonMessages,
	DescriptionItem,
	DescriptionList,
	DiffView,
	EmptyState,
	Heading,
	Inline,
	Input,
	Label,
	LoadErrorAlert,
	Skeleton,
	Stack,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Text,
	TextButton,
	toast,
	useConfirm,
} from "@monti-cms/admin/kit";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, GitPullRequest, KeyRound, RefreshCw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { lineDiff } from "../diff";
import {
	assignGitSyncKey,
	type ConflictView,
	flushGitSync,
	getGitSyncStatus,
	gitSyncKeys,
	listGitSyncConflicts,
	pullGitSync,
	resolveGitSyncConflict,
	type SlotKeyView,
	type StatusView,
} from "./api";
import { gitSyncMessages } from "./page.messages";

type Tab = "sync" | "conflicts" | "settings";

/** The Git sync screen: what each target did last, "Pull now", the conflicts with a diff, and the token and webhook secret. */
export function GitSyncPage() {
	const site = useSite();
	const t = useTranslator(gitSyncMessages);
	const [tab, setTab] = useState<Tab>("sync");

	const status = useQuery({
		queryKey: gitSyncKeys.status(),
		queryFn: ({ signal }) => getGitSyncStatus(site, { signal, fallback: t("load.failed") }),
	});
	const conflicts = useQuery({
		queryKey: gitSyncKeys.conflicts(),
		queryFn: ({ signal }) => listGitSyncConflicts(site, { signal, fallback: t("conflicts.loadFailed") }),
	});
	const conflictCount = conflicts.data?.items.length ?? 0;

	return (
		<Stack gap={0} grow minHeight={0} overflow="hidden">
			<Tabs fill value={tab} onValueChange={(value) => setTab(value as Tab)}>
				<TabsList variant="bar">
					<TabsTrigger value="sync">
						<GitBranch aria-hidden />
						{t("tab.sync")}
					</TabsTrigger>
					<TabsTrigger value="conflicts" count={conflictCount > 0 ? conflictCount : undefined}>
						<TriangleAlert aria-hidden />
						{t("tab.conflicts")}
					</TabsTrigger>
					<TabsTrigger value="settings">
						<KeyRound aria-hidden />
						{t("tab.settings")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="sync" scroll>
					<SyncTab
						status={status.data}
						error={status.error && !status.data ? errorText(site, status.error, t("load.failed")) : null}
						loading={status.isPending}
						onRetry={() => void status.refetch()}
					/>
				</TabsContent>
				<TabsContent value="conflicts" scroll>
					<ConflictsTab
						items={conflicts.data?.items}
						error={
							conflicts.error && !conflicts.data ? errorText(site, conflicts.error, t("conflicts.loadFailed")) : null
						}
						loading={conflicts.isPending}
					/>
				</TabsContent>
				<TabsContent value="settings" scroll>
					<SettingsTab status={status.data} />
				</TabsContent>
			</Tabs>
		</Stack>
	);
}

function ListSkeleton() {
	return (
		<Stack gap={12} paddingX={32} paddingY={16} aria-hidden>
			<Skeleton shape="block" />
			<Skeleton shape="block" />
		</Stack>
	);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Sync tab

function SyncTab({
	status,
	error,
	loading,
	onRetry,
}: {
	status: StatusView | undefined;
	error: string | null;
	loading: boolean;
	onRetry: () => void;
}) {
	const t = useTranslator(gitSyncMessages);

	const pull = useCmsMutation({
		fn: (target: string, { site }) => pullGitSync(site, target, t("pull.failed")),
		success: ({ results }) => {
			const total = { created: 0, applied: 0, conflicts: 0, errors: 0 };
			for (const { summary } of results) {
				total.created += summary.created;
				total.applied += summary.applied;
				total.conflicts += summary.conflicts;
				total.errors += summary.errors.length;
			}
			return t("pull.done", total);
		},
		failure: t("pull.failed"),
		invalidate: [gitSyncKeys.all],
	});
	const flush = useCmsMutation({
		fn: (target: string, { site }) => flushGitSync(site, target, t("flush.failed")),
		success: ({ results }) =>
			t("flush.done", {
				written: results.reduce((sum, item) => sum + item.written, 0),
				removed: results.reduce((sum, item) => sum + item.removed, 0),
			}),
		failure: t("flush.failed"),
		invalidate: [gitSyncKeys.all],
	});

	if (loading) return <ListSkeleton />;
	if (error) {
		return (
			<Box paddingX={32} paddingY={16}>
				<LoadErrorAlert message={error} onRetry={onRetry} />
			</Box>
		);
	}
	if (!status) return null;
	if (status.targets.length === 0) {
		return <EmptyState icon={GitBranch} title={t("sync.empty")} />;
	}

	return (
		<Stack gap={0}>
			{!status.keys.token && (
				<Box paddingX={32} paddingTop={16}>
					<Alert layout="stack">
						<AlertDescription>{t("sync.noToken")}</AlertDescription>
					</Alert>
				</Box>
			)}
			{status.targets.map((target, index) => (
				<Stack
					as="section"
					key={target.id}
					aria-label={target.id}
					gap={12}
					border={index === 0 ? "y" : "bottom"}
					paddingX={32}
					paddingY={16}
				>
					<Inline gap={8} wrap>
						<Box grow minWidth={0}>
							<Heading as="h2" variant="label" truncate>
								<Text mono weight="medium">
									{target.repo}
								</Text>
								<Text mono tone="muted">
									@{target.branch}
								</Text>
							</Heading>
						</Box>
						<Badge variant="secondary">
							{target.mode === "pr" ? <GitPullRequest aria-hidden /> : <GitBranch aria-hidden />}
							{t(`target.mode.${target.mode}`)}
						</Badge>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							disabled={pull.isPending}
							onClick={() => pull.mutate(target.id)}
						>
							<RefreshCw aria-hidden />
							{t("pull.now")}
						</Button>
						{target.queued > 0 && (
							<Button
								type="button"
								size="sm"
								variant="secondary"
								disabled={flush.isPending}
								onClick={() => flush.mutate(target.id)}
							>
								{t("flush.now")}
							</Button>
						)}
					</Inline>
					<DescriptionList>
						<DescriptionItem label={t("target.folder")}>
							<Text mono variant="label">
								{target.folder || t("target.wholeRepo")}
							</Text>
						</DescriptionItem>
						<DescriptionItem label={t("target.path")}>
							<Text mono variant="label">
								{target.path}
							</Text>
						</DescriptionItem>
						<DescriptionItem label={t("target.format")}>
							<Text mono variant="label">
								{target.format}
							</Text>
						</DescriptionItem>
						<DescriptionItem label={t("target.collections")}>{target.collections.join(", ")}</DescriptionItem>
						<DescriptionItem label={t("target.lastPull")}>
							{target.lastPull
								? t("target.pull", {
										created: target.lastPull.created,
										applied: target.lastPull.applied,
										unchanged: target.lastPull.unchanged,
										conflicts: target.lastPull.conflicts,
									})
								: t("target.never")}
						</DescriptionItem>
						<DescriptionItem label={t("target.lastFlush")}>
							{target.lastFlush ? (
								<>
									{t("target.flush", {
										files: target.lastFlush.files,
										commit: target.lastFlush.commitSha.slice(0, 7),
										branch: target.lastFlush.branch,
									})}
									{target.lastFlush.pullRequestUrl && (
										<>
											{" · "}
											<TextButton
												variant="underline"
												href={target.lastFlush.pullRequestUrl}
												target="_blank"
												rel="noreferrer"
											>
												{t("target.pullRequest")}
											</TextButton>
										</>
									)}
									{target.lastFlush.note && (
										<Text as="div" tone="muted">
											{target.lastFlush.note}
										</Text>
									)}
								</>
							) : (
								t("target.never")
							)}
						</DescriptionItem>
					</DescriptionList>
					<Inline gap={8} wrap>
						<Badge variant="outline">{t("target.synced", { count: target.synced })}</Badge>
						{target.queued > 0 && <Badge variant="outline">{t("target.queued", { count: target.queued })}</Badge>}
						{target.conflicts > 0 && (
							<Badge variant="danger">{t("target.conflicts", { count: target.conflicts })}</Badge>
						)}
					</Inline>
					{target.lastPull && target.lastPull.errors.length > 0 && (
						<Stack gap={4}>
							<Heading as="h3" variant="label">
								{t("summary.errors")}
							</Heading>
							<Stack as="ul" gap={2}>
								{target.lastPull.errors.map((item) => (
									<Text as="li" key={item.path} variant="caption" tone="danger">
										<Text mono variant="caption">
											{item.path}
										</Text>
										: {item.message}
									</Text>
								))}
							</Stack>
						</Stack>
					)}
					{target.lastPull && target.lastPull.skipped.length > 0 && (
						<Stack gap={4}>
							<Heading as="h3" variant="label">
								{t("summary.skipped")}
							</Heading>
							<Stack as="ul" gap={2}>
								{target.lastPull.skipped.map((item) => (
									<Text as="li" key={item.path} variant="caption" tone="muted">
										<Text mono variant="caption">
											{item.path}
										</Text>
										: {item.reason}
									</Text>
								))}
							</Stack>
						</Stack>
					)}
				</Stack>
			))}
		</Stack>
	);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Conflicts tab

/** The server text against the git text as a line diff: `-` lines are only on the server, `+` lines only in git. */
export function ConflictDiff({ serverText, gitText }: { serverText: string | null; gitText: string }) {
	const t = useTranslator(gitSyncMessages);
	const lines = useMemo(() => lineDiff(serverText ?? "", gitText), [serverText, gitText]);
	const identical = serverText !== null && lines.every((line) => line.type === "same");
	return (
		<Stack gap={4}>
			<Inline gap={16}>
				<Text variant="caption" tone="muted">
					- {t("conflicts.server")}
					{serverText === null && ` ${t("conflicts.serverRemoved")}`}
				</Text>
				<Text variant="caption" tone="muted">
					+ {t("conflicts.git")}
				</Text>
			</Inline>
			{identical ? (
				<Text as="p" variant="caption" tone="muted">
					{t("conflicts.same")}
				</Text>
			) : (
				<DiffView lines={lines} />
			)}
			<Text as="p" variant="caption" tone="muted">
				{t("conflicts.legend")}
			</Text>
		</Stack>
	);
}

function ConflictsTab({
	items,
	error,
	loading,
}: {
	items: ConflictView[] | undefined;
	error: string | null;
	loading: boolean;
}) {
	const t = useTranslator(gitSyncMessages);
	const { confirm, dialog } = useConfirm();

	const resolve = useCmsMutation({
		fn: (params: { conflict: ConflictView; resolution: "git" | "server" }, { site }) =>
			resolveGitSyncConflict(site, params.conflict, params.resolution, t("conflicts.resolve.failed")),
		success: (_result, params) => t(`conflicts.resolved.${params.resolution}` as const),
		failure: t("conflicts.resolve.failed"),
		invalidate: [gitSyncKeys.all],
	});

	const decide = async (conflict: ConflictView, resolution: "git" | "server") => {
		const ok = await confirm({
			title: t(`conflicts.${resolution}.title`),
			description: t(`conflicts.${resolution}.ask`, { label: conflict.label, path: conflict.path }),
			confirmLabel: t(resolution === "git" ? "conflicts.useGit" : "conflicts.useServer"),
			destructive: true,
		});
		if (ok) resolve.mutate({ conflict, resolution });
	};

	if (loading) return <ListSkeleton />;
	if (error) {
		return (
			<Box paddingX={32} paddingY={16}>
				<LoadErrorAlert message={error} />
			</Box>
		);
	}
	if (!items || items.length === 0) {
		return <EmptyState icon={GitBranch} title={t("conflicts.empty")} />;
	}
	return (
		<Stack gap={0}>
			{items.map((conflict, index) => (
				<Stack
					as="section"
					key={conflict.id}
					aria-label={conflict.label}
					gap={12}
					border={index === 0 ? "y" : "bottom"}
					paddingX={32}
					paddingY={16}
				>
					<Stack gap={4}>
						<Heading as="h2" variant="label">
							{conflict.label}
						</Heading>
						<Text as="p" variant="caption" tone="muted">
							<Text mono variant="caption">
								{conflict.path}
							</Text>{" "}
							· {conflict.repo}
						</Text>
						<Text as="p" variant="caption">
							{t(`conflicts.reason.${conflict.reason}`)}
						</Text>
					</Stack>
					<ConflictDiff serverText={conflict.serverText} gitText={conflict.gitText} />
					<Inline gap={8} wrap>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							disabled={resolve.isPending}
							onClick={() => void decide(conflict, "git")}
						>
							{t("conflicts.useGit")}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							disabled={resolve.isPending}
							onClick={() => void decide(conflict, "server")}
						>
							{t("conflicts.useServer")}
						</Button>
					</Inline>
				</Stack>
			))}
			{dialog}
		</Stack>
	);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Settings tab

/** A random secret for the webhook, as hex. */
const generateSecret = (): string => {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const keyHint = (key: SlotKeyView) => `${key.name}${key.tail ? ` ••••${key.tail}` : ""}`;
const keyState = (key: SlotKeyView | null) => (!key ? "unset" : key.readable ? "set" : "unreadable");

function SettingsTab({ status }: { status: StatusView | undefined }) {
	const t = useTranslator(gitSyncMessages);
	const tc = useTranslator(commonMessages);
	// What the token field shows until it is changed: the key the token uses now, or an empty new key.
	const [picked, setPicked] = useState<ApiKeyChoice | null>(null);
	// The webhook secret as typed or generated. It is shown only here, before it is saved: afterwards the store keeps it encrypted.
	const [secret, setSecret] = useState("");
	const [revealed, setRevealed] = useState(false);

	// Both secrets are keys of the API key store assigned to the plugin's slots. A token is followed by the server (the slot's `onChange`), so what waited for one goes out.
	const assign = useCmsMutation({
		fn: (values: { slot: "token" | "webhook-secret"; key: ApiKeyChoice }, { site }) =>
			assignGitSyncKey(site, values, tc("saveFailed")),
		success: tc("saved"),
		failure: tc("saveFailed"),
		// A key may have been added to the store, and the key's uses changed.
		invalidate: [apiKeysKeys.all, gitSyncKeys.all],
		onSuccess: (_result, values) => {
			if (values.slot === "token") setPicked(null);
			else setSecret("");
		},
	});

	if (!status) return <ListSkeleton />;
	const { keys } = status;
	const webhookUrl = `${typeof window === "undefined" ? "" : window.location.origin}${adminApiUrl("/v1/git-sync/webhook")}`;
	const tokenKey = keys.token;
	const savedChoice: ApiKeyChoice = tokenKey ? { use: "saved", keyId: tokenKey.id } : { use: "new", value: "" };
	const choice = picked ?? savedChoice;
	// Nothing to save while the field shows the key the token already uses.
	const tokenChanged = choice.use === "new" || (choice.use === "saved" && choice.keyId !== tokenKey?.id);
	const secretKey = keys.webhookSecret;

	return (
		<Stack gap={0} maxWidth="reading" paddingX={32}>
			{!keys.secretsAvailable && (
				<Box paddingY={16}>
					<Alert tone="danger" layout="stack">
						<AlertDescription>{t("settings.secretMissing")}</AlertDescription>
					</Alert>
				</Box>
			)}

			<Stack
				as="form"
				gap={8}
				border="bottom"
				paddingY={24}
				onSubmit={(event) => {
					event.preventDefault();
					if (tokenChanged && choiceReady(choice)) assign.mutate({ slot: "token", key: choice });
				}}
			>
				<Text as="p" weight="medium">
					{t("settings.token")}
				</Text>
				<Text as="p" variant="caption" tone="muted">
					{t("settings.token.help")}
				</Text>
				<Text as="p" variant="caption">
					{t(`settings.token.state.${keyState(tokenKey)}`, { hint: tokenKey ? keyHint(tokenKey) : "" })}
				</Text>
				<ApiKeyField label={t("settings.token")} baseName="GitHub" value={choice} onChange={setPicked} />
				<Inline gap={8}>
					<Button
						type="submit"
						size="sm"
						disabled={!keys.secretsAvailable || !tokenChanged || !choiceReady(choice) || assign.isPending}
					>
						{tc("save")}
					</Button>
					{tokenKey && (
						<Button
							type="button"
							size="sm"
							variant="secondary"
							disabled={assign.isPending}
							onClick={() => assign.mutate({ slot: "token", key: { use: "none" } })}
						>
							{t("settings.remove")}
						</Button>
					)}
				</Inline>
			</Stack>

			<Stack
				as="form"
				gap={8}
				paddingY={24}
				onSubmit={(event) => {
					event.preventDefault();
					if (secret.trim()) assign.mutate({ slot: "webhook-secret", key: { use: "new", value: secret.trim() } });
				}}
			>
				<Text as="label" htmlFor="git-sync-secret" weight="medium">
					{t("settings.webhook")}
				</Text>
				<Text as="p" variant="caption">
					{t(`settings.webhook.state.${keyState(secretKey)}`, { hint: secretKey ? keyHint(secretKey) : "" })}
				</Text>
				<Stack gap={4}>
					<Label htmlFor="git-sync-url" size="caption" tone="muted">
						{t("settings.webhook.url")}
					</Label>
					<Input id="git-sync-url" readOnly value={webhookUrl} size="sm" mono />
				</Stack>
				<Text as="p" variant="caption" tone="muted">
					{t("settings.webhook.help")}
				</Text>
				<Inline gap={8} wrap>
					<Box grow minWidth={0}>
						<Input
							id="git-sync-secret"
							type={revealed ? "text" : "password"}
							autoComplete="off"
							spellCheck={false}
							value={secret}
							placeholder={t("settings.webhook.new")}
							onChange={(event) => setSecret(event.target.value)}
							mono
						/>
					</Box>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						onClick={() => {
							setSecret(generateSecret());
							// A generated value has to be seen once: it goes into GitHub, and the store does not show it again.
							setRevealed(true);
						}}
					>
						{t("settings.generate")}
					</Button>
					<Button type="button" size="sm" variant="secondary" onClick={() => setRevealed((shown) => !shown)}>
						{revealed ? t("settings.hide") : t("settings.show")}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						disabled={!secret}
						onClick={() =>
							void navigator.clipboard.writeText(secret).then(
								() => toast(t("settings.copied")),
								() => toast.error(tc("copyFailed")),
							)
						}
					>
						{t("settings.copy")}
					</Button>
				</Inline>
				<Inline gap={8}>
					<Button type="submit" size="sm" disabled={!keys.secretsAvailable || !secret.trim() || assign.isPending}>
						{tc("save")}
					</Button>
					{secretKey && (
						<Button
							type="button"
							size="sm"
							variant="secondary"
							disabled={assign.isPending}
							onClick={() => assign.mutate({ slot: "webhook-secret", key: { use: "none" } })}
						>
							{t("settings.remove")}
						</Button>
					)}
				</Inline>
			</Stack>
		</Stack>
	);
}
