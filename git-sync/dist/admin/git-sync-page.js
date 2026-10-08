"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsFetch, errorText } from "@monti-cms/admin/api";
import { AdminShell, Alert, AlertDescription, Badge, Button, Empty, EmptyHeader, EmptyMedia, EmptyTitle, Input, Label, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, useConfirm, } from "@monti-cms/admin/kit";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, GitPullRequest, KeyRound, RefreshCw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { lineDiff } from "../diff.js";
import { gitSyncMessages } from "./page.messages.js";
const KEY = ["cms", "git-sync"];
const STATUS_KEY = [...KEY, "status"];
const CONFLICTS_KEY = [...KEY, "conflicts"];
/** The Git sync screen: what each target did last, "Pull now", the conflicts with a diff, and the token and webhook secret. */
export function GitSyncPage() {
    const site = useSite();
    const t = useTranslator(gitSyncMessages);
    const queryClient = useQueryClient();
    const [tab, setTab] = useState("sync");
    const status = useQuery({
        queryKey: STATUS_KEY,
        queryFn: ({ signal }) => cmsFetch(site, cmsApiUrl("/v1/git-sync/status"), { signal, fallback: t("load.failed") }),
    });
    const conflicts = useQuery({
        queryKey: CONFLICTS_KEY,
        queryFn: ({ signal }) => cmsFetch(site, cmsApiUrl("/v1/git-sync/conflicts"), {
            signal,
            fallback: t("conflicts.loadFailed"),
        }),
    });
    const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
    const conflictCount = conflicts.data?.items.length ?? 0;
    return (_jsx(AdminShell, { title: t("title"), sidebar: { activeNav: "git-sync" }, children: _jsxs(Tabs, { value: tab, onValueChange: (value) => setTab(value), className: "flex min-h-0 flex-1 flex-col gap-0", children: [_jsxs(TabsList, { variant: "line", className: "h-10 w-full shrink-0 justify-start gap-4 border-b px-4", children: [_jsxs(TabsTrigger, { value: "sync", className: "flex-none px-0 text-xs", children: [_jsx(GitBranch, { "aria-hidden": true }), t("tab.sync")] }), _jsxs(TabsTrigger, { value: "conflicts", className: "flex-none px-0 text-xs", children: [_jsx(TriangleAlert, { "aria-hidden": true }), t("tab.conflicts"), conflictCount > 0 && _jsx(Badge, { variant: "destructive", children: conflictCount })] }), _jsxs(TabsTrigger, { value: "settings", className: "flex-none px-0 text-xs", children: [_jsx(KeyRound, { "aria-hidden": true }), t("tab.settings")] })] }), _jsx(TabsContent, { value: "sync", className: "min-h-0 flex-1 overflow-auto", children: _jsx(SyncTab, { status: status.data, error: status.error && !status.data ? errorText(site, status.error, t("load.failed")) : null, loading: status.isPending, onRetry: () => void status.refetch(), onChanged: refresh }) }), _jsx(TabsContent, { value: "conflicts", className: "min-h-0 flex-1 overflow-auto", children: _jsx(ConflictsTab, { items: conflicts.data?.items, error: conflicts.error && !conflicts.data ? errorText(site, conflicts.error, t("conflicts.loadFailed")) : null, loading: conflicts.isPending, onChanged: refresh }) }), _jsx(TabsContent, { value: "settings", className: "min-h-0 flex-1 overflow-auto", children: _jsx(SettingsTab, { status: status.data, onChanged: refresh }) })] }) }));
}
function ErrorBar({ message, onRetry }) {
    const t = useTranslator(gitSyncMessages);
    return (_jsxs(Alert, { variant: "danger", className: "m-5 flex w-auto items-center justify-between", children: [_jsx(AlertDescription, { className: "col-start-auto", children: message }), onRetry && (_jsx(Button, { type: "button", variant: "outline", size: "xs", onClick: onRetry, children: t("load.retry") }))] }));
}
function ListSkeleton() {
    return (_jsxs("div", { className: "space-y-3 p-5", "aria-hidden": true, children: [_jsx(Skeleton, { className: "h-24 w-full" }), _jsx(Skeleton, { className: "h-24 w-full" })] }));
}
// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Sync tab
function SyncTab({ status, error, loading, onRetry, onChanged, }) {
    const site = useSite();
    const t = useTranslator(gitSyncMessages);
    const pull = useMutation({
        mutationFn: (target) => cmsFetch(site, cmsApiUrl("/v1/git-sync/pull"), {
            method: "POST",
            json: { target },
            fallback: t("pull.failed"),
        }),
        onSuccess: ({ results }) => {
            const total = { created: 0, applied: 0, conflicts: 0, errors: 0 };
            for (const { summary } of results) {
                total.created += summary.created;
                total.applied += summary.applied;
                total.conflicts += summary.conflicts;
                total.errors += summary.errors.length;
            }
            toast.success(t("pull.done", total));
        },
        onError: (err) => toast.error(errorText(site, err, t("pull.failed"))),
        onSettled: onChanged,
    });
    const flush = useMutation({
        mutationFn: (target) => cmsFetch(site, cmsApiUrl("/v1/git-sync/flush"), {
            method: "POST",
            json: { target },
            fallback: t("flush.failed"),
        }),
        onSuccess: ({ results }) => toast.success(t("flush.done", {
            written: results.reduce((sum, item) => sum + item.written, 0),
            removed: results.reduce((sum, item) => sum + item.removed, 0),
        })),
        onError: (err) => toast.error(errorText(site, err, t("flush.failed"))),
        onSettled: onChanged,
    });
    if (loading)
        return _jsx(ListSkeleton, {});
    if (error)
        return _jsx(ErrorBar, { message: error, onRetry: onRetry });
    if (!status)
        return null;
    if (status.targets.length === 0) {
        return (_jsx(Empty, { className: "h-full", children: _jsxs(EmptyHeader, { children: [_jsx(EmptyMedia, { variant: "icon", children: _jsx(GitBranch, { "aria-hidden": true }) }), _jsx(EmptyTitle, { children: t("sync.empty") })] }) }));
    }
    return (_jsxs("div", { className: "space-y-4 p-5", children: [!status.settings.token.set && (_jsx(Alert, { layout: "stack", children: _jsx(AlertDescription, { className: "col-start-auto", children: t("sync.noToken") }) })), status.targets.map((target) => (_jsxs("section", { "aria-label": target.id, className: "space-y-3 rounded-lg border border-cms-border p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("h2", { className: "min-w-0 flex-1 truncate font-medium text-sm", children: [target.repo, _jsxs("span", { className: "text-cms-muted-foreground", children: ["@", target.branch] })] }), _jsxs(Badge, { variant: "secondary", children: [target.mode === "pr" ? _jsx(GitPullRequest, { "aria-hidden": true }) : _jsx(GitBranch, { "aria-hidden": true }), t(`target.mode.${target.mode}`)] }), _jsxs(Button, { type: "button", size: "sm", variant: "outline", disabled: pull.isPending, onClick: () => pull.mutate(target.id), children: [_jsx(RefreshCw, { "aria-hidden": true }), t("pull.now")] }), target.queued > 0 && (_jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: flush.isPending, onClick: () => flush.mutate(target.id), children: t("flush.now") }))] }), _jsxs("dl", { className: "grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs", children: [_jsx("dt", { className: "text-cms-muted-foreground", children: t("target.folder") }), _jsx("dd", { className: "font-mono", children: target.folder || t("target.wholeRepo") }), _jsx("dt", { className: "text-cms-muted-foreground", children: t("target.path") }), _jsx("dd", { className: "font-mono", children: target.path }), _jsx("dt", { className: "text-cms-muted-foreground", children: t("target.format") }), _jsx("dd", { className: "font-mono", children: target.format }), _jsx("dt", { className: "text-cms-muted-foreground", children: t("target.collections") }), _jsx("dd", { children: target.collections.join(", ") }), _jsx("dt", { className: "text-cms-muted-foreground", children: t("target.lastPull") }), _jsx("dd", { children: target.lastPull
                                    ? t("target.pull", {
                                        created: target.lastPull.created,
                                        applied: target.lastPull.applied,
                                        unchanged: target.lastPull.unchanged,
                                        conflicts: target.lastPull.conflicts,
                                    })
                                    : t("target.never") }), _jsx("dt", { className: "text-cms-muted-foreground", children: t("target.lastFlush") }), _jsx("dd", { children: target.lastFlush ? (_jsxs(_Fragment, { children: [t("target.flush", {
                                            files: target.lastFlush.files,
                                            commit: target.lastFlush.commitSha.slice(0, 7),
                                            branch: target.lastFlush.branch,
                                        }), target.lastFlush.pullRequestUrl && (_jsxs(_Fragment, { children: [" · ", _jsx("a", { className: "underline", href: target.lastFlush.pullRequestUrl, target: "_blank", rel: "noreferrer", children: t("target.pullRequest") })] })), target.lastFlush.note && (_jsx("span", { className: "block text-cms-muted-foreground", children: target.lastFlush.note }))] })) : (t("target.never")) })] }), _jsxs("div", { className: "flex flex-wrap gap-2 text-xs", children: [_jsx(Badge, { variant: "outline", children: t("target.synced", { count: target.synced }) }), target.queued > 0 && _jsx(Badge, { variant: "outline", children: t("target.queued", { count: target.queued }) }), target.conflicts > 0 && (_jsx(Badge, { variant: "destructive", children: t("target.conflicts", { count: target.conflicts }) }))] }), target.lastPull && target.lastPull.errors.length > 0 && (_jsxs("div", { className: "space-y-1 text-xs", children: [_jsx("h3", { className: "font-medium", children: t("summary.errors") }), _jsx("ul", { className: "space-y-0.5", children: target.lastPull.errors.map((item) => (_jsxs("li", { className: "text-cms-destructive", children: [_jsx("span", { className: "font-mono", children: item.path }), ": ", item.message] }, item.path))) })] })), target.lastPull && target.lastPull.skipped.length > 0 && (_jsxs("div", { className: "space-y-1 text-xs", children: [_jsx("h3", { className: "font-medium", children: t("summary.skipped") }), _jsx("ul", { className: "space-y-0.5 text-cms-muted-foreground", children: target.lastPull.skipped.map((item) => (_jsxs("li", { children: [_jsx("span", { className: "font-mono", children: item.path }), ": ", item.reason] }, item.path))) })] }))] }, target.id)))] }));
}
// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Conflicts tab
const LINE_STYLE = {
    same: "text-cms-muted-foreground",
    remove: "bg-cms-destructive/15 text-cms-destructive",
    add: "bg-cms-primary/10 text-cms-foreground",
};
const LINE_MARK = { same: " ", remove: "-", add: "+" };
/** The server text against the git text as a line diff: `-` lines are only on the server, `+` lines only in git. */
export function ConflictDiff({ serverText, gitText }) {
    const t = useTranslator(gitSyncMessages);
    const lines = useMemo(() => lineDiff(serverText ?? "", gitText), [serverText, gitText]);
    const identical = serverText !== null && lines.every((line) => line.type === "same");
    return (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex gap-4 text-cms-muted-foreground text-xs", children: [_jsxs("span", { children: ["- ", t("conflicts.server"), serverText === null && ` ${t("conflicts.serverRemoved")}`] }), _jsxs("span", { children: ["+ ", t("conflicts.git")] })] }), identical ? (_jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("conflicts.same") })) : (_jsx("fieldset", { className: "m-0 max-h-[50vh] min-w-0 overflow-auto rounded-md border border-cms-border p-0 font-mono text-xs leading-relaxed", "aria-label": `${t("conflicts.server")} / ${t("conflicts.git")}`, children: lines.map((line, index) => (_jsxs("div", { "data-diff": line.type, className: `whitespace-pre-wrap px-2 ${LINE_STYLE[line.type]}`, children: [LINE_MARK[line.type], " ", line.text] }, index))) })), _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("conflicts.legend") })] }));
}
function ConflictsTab({ items, error, loading, onChanged, }) {
    const site = useSite();
    const t = useTranslator(gitSyncMessages);
    const { confirm, dialog } = useConfirm();
    const resolve = useMutation({
        mutationFn: (params) => cmsFetch(site, cmsApiUrl("/v1/git-sync/conflicts/resolve"), {
            method: "POST",
            json: {
                target: params.conflict.target,
                entryId: params.conflict.entryId,
                resolution: params.resolution,
                gitSha: params.conflict.gitSha,
            },
            fallback: t("conflicts.resolve.failed"),
        }),
        onSuccess: (_result, params) => toast.success(t(`conflicts.resolved.${params.resolution}`)),
        onError: (err) => toast.error(errorText(site, err, t("conflicts.resolve.failed"))),
        onSettled: onChanged,
    });
    const decide = async (conflict, resolution) => {
        const ok = await confirm({
            title: t(`conflicts.${resolution}.title`),
            description: t(`conflicts.${resolution}.ask`, { label: conflict.label, path: conflict.path }),
            confirmLabel: t(resolution === "git" ? "conflicts.useGit" : "conflicts.useServer"),
            destructive: true,
        });
        if (ok)
            resolve.mutate({ conflict, resolution });
    };
    if (loading)
        return _jsx(ListSkeleton, {});
    if (error)
        return _jsx(ErrorBar, { message: error });
    if (!items || items.length === 0) {
        return (_jsx(Empty, { className: "h-full", children: _jsxs(EmptyHeader, { children: [_jsx(EmptyMedia, { variant: "icon", children: _jsx(GitBranch, { "aria-hidden": true }) }), _jsx(EmptyTitle, { children: t("conflicts.empty") })] }) }));
    }
    return (_jsxs("div", { className: "space-y-4 p-5", children: [items.map((conflict) => (_jsxs("section", { "aria-label": conflict.label, className: "space-y-3 rounded-lg border border-cms-border p-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h2", { className: "font-medium text-sm", children: conflict.label }), _jsxs("p", { className: "text-cms-muted-foreground text-xs", children: [_jsx("span", { className: "font-mono", children: conflict.path }), " \u00B7 ", conflict.repo] }), _jsx("p", { className: "text-xs", children: t(`conflicts.reason.${conflict.reason}`) })] }), _jsx(ConflictDiff, { serverText: conflict.serverText, gitText: conflict.gitText }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: resolve.isPending, onClick: () => void decide(conflict, "git"), children: t("conflicts.useGit") }), _jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: resolve.isPending, onClick: () => void decide(conflict, "server"), children: t("conflicts.useServer") })] })] }, conflict.id))), dialog] }));
}
// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Settings tab
/** A random secret for the webhook, as hex. */
const generateSecret = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};
function SettingsTab({ status, onChanged }) {
    const site = useSite();
    const t = useTranslator(gitSyncMessages);
    const [token, setToken] = useState("");
    const [secret, setSecret] = useState("");
    const save = useMutation({
        mutationFn: (values) => cmsFetch(site, cmsApiUrl("/v1/git-sync/settings"), {
            method: "PUT",
            json: { ...values, expectedVersion: status?.settings.version ?? 0 },
            fallback: t("settings.save.failed"),
        }),
        onSuccess: () => {
            setToken("");
            setSecret("");
            toast.success(t("settings.saved"));
        },
        onError: (err) => toast.error(errorText(site, err, t("settings.save.failed"))),
        onSettled: onChanged,
    });
    if (!status)
        return _jsx(ListSkeleton, {});
    const { settings } = status;
    const webhookUrl = `${typeof window === "undefined" ? "" : window.location.origin}${cmsApiUrl("/v1/git-sync/webhook")}`;
    const stateOf = (item) => !item.set ? "unset" : item.readable ? "set" : "unreadable";
    const tokenState = stateOf(settings.token);
    const secretState = stateOf(settings.webhookSecret);
    return (_jsxs("div", { className: "max-w-2xl space-y-8 p-5", children: [!settings.secretsAvailable && (_jsx(Alert, { variant: "danger", layout: "stack", children: _jsx(AlertDescription, { className: "col-start-auto", children: t("settings.secretMissing") }) })), _jsxs("form", { className: "space-y-2", onSubmit: (event) => {
                    event.preventDefault();
                    if (token.trim())
                        save.mutate({ token });
                }, children: [_jsx(Label, { htmlFor: "git-sync-token", className: "font-medium text-sm", children: t("settings.token") }), _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("settings.token.help") }), _jsx("p", { className: "text-xs", children: t(`settings.token.state.${tokenState}`, { hint: settings.token.hint ?? "" }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "git-sync-token", type: "password", autoComplete: "off", value: token, placeholder: t("settings.token.new"), onChange: (event) => setToken(event.target.value) }), _jsx(Button, { type: "submit", size: "sm", disabled: !settings.secretsAvailable || !token.trim() || save.isPending, children: t("settings.save") }), settings.token.set && (_jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: save.isPending, onClick: () => save.mutate({ token: null }), children: t("settings.remove") }))] })] }), _jsxs("form", { className: "space-y-2", onSubmit: (event) => {
                    event.preventDefault();
                    if (secret.trim())
                        save.mutate({ webhookSecret: secret });
                }, children: [_jsx(Label, { htmlFor: "git-sync-secret", className: "font-medium text-sm", children: t("settings.webhook") }), _jsx("p", { className: "text-xs", children: t(`settings.webhook.state.${secretState}`) }), _jsxs("div", { className: "space-y-1", children: [_jsx(Label, { htmlFor: "git-sync-url", className: "text-cms-muted-foreground text-xs", children: t("settings.webhook.url") }), _jsx(Input, { id: "git-sync-url", readOnly: true, value: webhookUrl, className: "font-mono text-xs" })] }), _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("settings.webhook.help") }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "git-sync-secret", type: "text", autoComplete: "off", value: secret, placeholder: t("settings.webhook.new"), onChange: (event) => setSecret(event.target.value) }), _jsx(Button, { type: "button", size: "sm", variant: "outline", onClick: () => setSecret(generateSecret()), children: t("settings.generate") }), _jsx(Button, { type: "submit", size: "sm", disabled: !settings.secretsAvailable || !secret.trim() || save.isPending, children: t("settings.save") }), settings.webhookSecret.set && (_jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: save.isPending, onClick: () => save.mutate({ webhookSecret: null }), children: t("settings.remove") }))] })] })] }));
}
