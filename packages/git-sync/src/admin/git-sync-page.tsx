"use client";

import { adminApiUrl, errorText, useCmsMutation, useSite, useTranslator } from "@monti-cms/admin";
import {
	Alert,
	AlertDescription,
	type ApiKeyChoice,
	ApiKeyField,
	apiKeysKeys,
	Badge,
	Button,
	choiceReady,
	commonMessages,
	EmptyState,
	FormField,
	FormFieldLabel,
	Input,
	LoadErrorAlert,
	PageTabs,
	Skeleton,
	Tabs,
	TabsContent,
	TabsTrigger,
	useConfirm,
} from "@monti-cms/admin/kit";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, GitPullRequest, KeyRound, RefreshCw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { type DiffLine, lineDiff } from "../diff";
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
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="flex min-h-0 flex-1 flex-col gap-0">
				<PageTabs className="border-monti-border px-8">
					<TabsTrigger value="sync" className="flex-none px-0 text-monti-body">
						<GitBranch aria-hidden />
						{t("tab.sync")}
					</TabsTrigger>
					<TabsTrigger value="conflicts" className="flex-none px-0 text-monti-body">
						<TriangleAlert aria-hidden />
						{t("tab.conflicts")}
						{conflictCount > 0 && <Badge variant="destructive">{conflictCount}</Badge>}
					</TabsTrigger>
					<TabsTrigger value="settings" className="flex-none px-0 text-monti-body">
						<KeyRound aria-hidden />
						{t("tab.settings")}
					</TabsTrigger>
				</PageTabs>
				<TabsContent value="sync" className="min-h-0 flex-1 overflow-auto">
					<SyncTab
						status={status.data}
						error={status.error && !status.data ? errorText(site, status.error, t("load.failed")) : null}
						loading={status.isPending}
						onRetry={() => void status.refetch()}
					/>
				</TabsContent>
				<TabsContent value="conflicts" className="min-h-0 flex-1 overflow-auto">
					<ConflictsTab
						items={conflicts.data?.items}
						error={
							conflicts.error && !conflicts.data ? errorText(site, conflicts.error, t("conflicts.loadFailed")) : null
						}
						loading={conflicts.isPending}
					/>
				</TabsContent>
				<TabsContent value="settings" className="min-h-0 flex-1 overflow-auto">
					<SettingsTab status={status.data} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

function ListSkeleton() {
	return (
		<div className="space-y-3 px-8 py-5" aria-hidden>
			<Skeleton className="h-24 w-full" />
			<Skeleton className="h-24 w-full" />
		</div>
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
	if (error) return <LoadErrorAlert className="mx-8 my-5" message={error} onRetry={onRetry} />;
	if (!status) return null;
	if (status.targets.length === 0) {
		return <EmptyState className="h-full" icon={GitBranch} title={t("sync.empty")} />;
	}

	return (
		<div>
			{!status.keys.token && (
				<Alert layout="stack" className="mx-8 mt-4 w-auto">
					<AlertDescription className="col-start-auto">{t("sync.noToken")}</AlertDescription>
				</Alert>
			)}
			{status.targets.map((target) => (
				<section
					key={target.id}
					aria-label={target.id}
					className="space-y-3 border-monti-border border-b px-8 py-5 first:border-t"
				>
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="min-w-0 flex-1 truncate font-medium font-mono text-monti-body">
							{target.repo}
							<span className="text-monti-muted-foreground">@{target.branch}</span>
						</h2>
						<Badge variant="secondary">
							{target.mode === "pr" ? <GitPullRequest aria-hidden /> : <GitBranch aria-hidden />}
							{t(`target.mode.${target.mode}`)}
						</Badge>
						<Button
							type="button"
							size="sm"
							variant="outline"
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
								variant="outline"
								disabled={flush.isPending}
								onClick={() => flush.mutate(target.id)}
							>
								{t("flush.now")}
							</Button>
						)}
					</div>
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-monti-caption">
						<dt className="text-monti-muted-foreground">{t("target.folder")}</dt>
						<dd className="font-mono">{target.folder || t("target.wholeRepo")}</dd>
						<dt className="text-monti-muted-foreground">{t("target.path")}</dt>
						<dd className="font-mono">{target.path}</dd>
						<dt className="text-monti-muted-foreground">{t("target.format")}</dt>
						<dd className="font-mono">{target.format}</dd>
						<dt className="text-monti-muted-foreground">{t("target.collections")}</dt>
						<dd>{target.collections.join(", ")}</dd>
						<dt className="text-monti-muted-foreground">{t("target.lastPull")}</dt>
						<dd>
							{target.lastPull
								? t("target.pull", {
										created: target.lastPull.created,
										applied: target.lastPull.applied,
										unchanged: target.lastPull.unchanged,
										conflicts: target.lastPull.conflicts,
									})
								: t("target.never")}
						</dd>
						<dt className="text-monti-muted-foreground">{t("target.lastFlush")}</dt>
						<dd>
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
											<a className="underline" href={target.lastFlush.pullRequestUrl} target="_blank" rel="noreferrer">
												{t("target.pullRequest")}
											</a>
										</>
									)}
									{target.lastFlush.note && (
										<span className="block text-monti-muted-foreground">{target.lastFlush.note}</span>
									)}
								</>
							) : (
								t("target.never")
							)}
						</dd>
					</dl>
					<div className="flex flex-wrap gap-2 text-monti-caption">
						<Badge variant="outline">{t("target.synced", { count: target.synced })}</Badge>
						{target.queued > 0 && <Badge variant="outline">{t("target.queued", { count: target.queued })}</Badge>}
						{target.conflicts > 0 && (
							<Badge variant="destructive">{t("target.conflicts", { count: target.conflicts })}</Badge>
						)}
					</div>
					{target.lastPull && target.lastPull.errors.length > 0 && (
						<div className="space-y-1 text-monti-caption">
							<h3 className="font-medium">{t("summary.errors")}</h3>
							<ul className="space-y-0.5">
								{target.lastPull.errors.map((item) => (
									<li key={item.path} className="text-monti-destructive-foreground">
										<span className="font-mono">{item.path}</span>: {item.message}
									</li>
								))}
							</ul>
						</div>
					)}
					{target.lastPull && target.lastPull.skipped.length > 0 && (
						<div className="space-y-1 text-monti-caption">
							<h3 className="font-medium">{t("summary.skipped")}</h3>
							<ul className="space-y-0.5 text-monti-muted-foreground">
								{target.lastPull.skipped.map((item) => (
									<li key={item.path}>
										<span className="font-mono">{item.path}</span>: {item.reason}
									</li>
								))}
							</ul>
						</div>
					)}
				</section>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Conflicts tab

const LINE_STYLE: Record<DiffLine["type"], string> = {
	same: "text-monti-muted-foreground",
	remove: "bg-monti-destructive-soft text-monti-destructive-foreground",
	add: "bg-monti-primary/10 text-monti-foreground",
};
const LINE_MARK: Record<DiffLine["type"], string> = { same: " ", remove: "-", add: "+" };

/** The server text against the git text as a line diff: `-` lines are only on the server, `+` lines only in git. */
export function ConflictDiff({ serverText, gitText }: { serverText: string | null; gitText: string }) {
	const t = useTranslator(gitSyncMessages);
	const lines = useMemo(() => lineDiff(serverText ?? "", gitText), [serverText, gitText]);
	const identical = serverText !== null && lines.every((line) => line.type === "same");
	return (
		<div className="space-y-1">
			<div className="flex gap-4 text-monti-caption text-monti-muted-foreground">
				<span>
					- {t("conflicts.server")}
					{serverText === null && ` ${t("conflicts.serverRemoved")}`}
				</span>
				<span>+ {t("conflicts.git")}</span>
			</div>
			{identical ? (
				<p className="text-monti-caption text-monti-muted-foreground">{t("conflicts.same")}</p>
			) : (
				<fieldset
					className="m-0 max-h-[50vh] min-w-0 overflow-auto rounded-md border border-monti-border p-0 font-mono text-monti-caption leading-relaxed"
					aria-label={`${t("conflicts.server")} / ${t("conflicts.git")}`}
				>
					{lines.map((line, index) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: a diff is a fixed list of lines; the index is its identity
							key={index}
							data-diff={line.type}
							className={`whitespace-pre-wrap px-2 ${LINE_STYLE[line.type]}`}
						>
							{LINE_MARK[line.type]} {line.text}
						</div>
					))}
				</fieldset>
			)}
			<p className="text-monti-caption text-monti-muted-foreground">{t("conflicts.legend")}</p>
		</div>
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
	if (error) return <LoadErrorAlert className="mx-8 my-5" message={error} />;
	if (!items || items.length === 0) {
		return <EmptyState className="h-full" icon={GitBranch} title={t("conflicts.empty")} />;
	}
	return (
		<div>
			{items.map((conflict) => (
				<section
					key={conflict.id}
					aria-label={conflict.label}
					className="space-y-3 border-monti-border border-b px-8 py-5 first:border-t"
				>
					<div className="space-y-1">
						<h2 className="font-medium text-monti-body">{conflict.label}</h2>
						<p className="text-monti-caption text-monti-muted-foreground">
							<span className="font-mono">{conflict.path}</span> · {conflict.repo}
						</p>
						<p className="text-monti-caption">{t(`conflicts.reason.${conflict.reason}`)}</p>
					</div>
					<ConflictDiff serverText={conflict.serverText} gitText={conflict.gitText} />
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={resolve.isPending}
							onClick={() => void decide(conflict, "git")}
						>
							{t("conflicts.useGit")}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={resolve.isPending}
							onClick={() => void decide(conflict, "server")}
						>
							{t("conflicts.useServer")}
						</Button>
					</div>
				</section>
			))}
			{dialog}
		</div>
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
		<div className="max-w-3xl divide-y divide-monti-border px-8 [&>*]:py-6">
			{!keys.secretsAvailable && (
				<Alert variant="destructive" layout="stack" className="my-5 w-auto">
					<AlertDescription className="col-start-auto">{t("settings.secretMissing")}</AlertDescription>
				</Alert>
			)}

			<form
				className="space-y-2"
				onSubmit={(event) => {
					event.preventDefault();
					if (tokenChanged && choiceReady(choice)) assign.mutate({ slot: "token", key: choice });
				}}
			>
				<p className="font-medium text-monti-body">{t("settings.token")}</p>
				<p className="text-monti-caption text-monti-muted-foreground">{t("settings.token.help")}</p>
				<p className="text-monti-caption">
					{t(`settings.token.state.${keyState(tokenKey)}`, { hint: tokenKey ? keyHint(tokenKey) : "" })}
				</p>
				<ApiKeyField label={t("settings.token")} baseName="GitHub" value={choice} onChange={setPicked} />
				<div className="flex gap-2">
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
							variant="outline"
							disabled={assign.isPending}
							onClick={() => assign.mutate({ slot: "token", key: { use: "none" } })}
						>
							{t("settings.remove")}
						</Button>
					)}
				</div>
			</form>

			<form
				className="space-y-2"
				onSubmit={(event) => {
					event.preventDefault();
					if (secret.trim()) assign.mutate({ slot: "webhook-secret", key: { use: "new", value: secret.trim() } });
				}}
			>
				<FormFieldLabel htmlFor="git-sync-secret" className="font-medium text-monti-body">
					{t("settings.webhook")}
				</FormFieldLabel>
				<p className="text-monti-caption">
					{t(`settings.webhook.state.${keyState(secretKey)}`, { hint: secretKey ? keyHint(secretKey) : "" })}
				</p>
				<FormField className="gap-1">
					<FormFieldLabel htmlFor="git-sync-url" className="text-monti-caption text-monti-muted-foreground">
						{t("settings.webhook.url")}
					</FormFieldLabel>
					<Input id="git-sync-url" readOnly value={webhookUrl} className="font-mono text-monti-caption" />
				</FormField>
				<p className="text-monti-caption text-monti-muted-foreground">{t("settings.webhook.help")}</p>
				<div className="flex flex-wrap gap-2">
					<Input
						id="git-sync-secret"
						type={revealed ? "text" : "password"}
						autoComplete="off"
						spellCheck={false}
						value={secret}
						placeholder={t("settings.webhook.new")}
						onChange={(event) => setSecret(event.target.value)}
						className="min-w-0 flex-1 font-mono"
					/>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => {
							setSecret(generateSecret());
							// A generated value has to be seen once: it goes into GitHub, and the store does not show it again.
							setRevealed(true);
						}}
					>
						{t("settings.generate")}
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={() => setRevealed((shown) => !shown)}>
						{revealed ? t("settings.hide") : t("settings.show")}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={!secret}
						onClick={() =>
							void navigator.clipboard.writeText(secret).then(
								() => toast.success(t("settings.copied")),
								() => toast.error(tc("copyFailed")),
							)
						}
					>
						{t("settings.copy")}
					</Button>
				</div>
				<div className="flex gap-2">
					<Button type="submit" size="sm" disabled={!keys.secretsAvailable || !secret.trim() || assign.isPending}>
						{tc("save")}
					</Button>
					{secretKey && (
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={assign.isPending}
							onClick={() => assign.mutate({ slot: "webhook-secret", key: { use: "none" } })}
						>
							{t("settings.remove")}
						</Button>
					)}
				</div>
			</form>
		</div>
	);
}
