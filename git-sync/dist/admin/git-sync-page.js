"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { errorText, useCmsMutation } from "@monti-cms/admin/api";
import { Alert, AlertDescription, ApiKeyField, apiKeysKeys, Badge, Button, choiceReady, commonMessages, EmptyState, Field, FieldLabel, Input, LoadErrorAlert, PageTabs, Panel, Skeleton, Tabs, TabsContent, TabsTrigger, useConfirm, } from "@monti-cms/admin/kit";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, GitPullRequest, KeyRound, RefreshCw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { lineDiff } from "../diff.js";
import { assignGitSyncKey, flushGitSync, getGitSyncStatus, gitSyncKeys, listGitSyncConflicts, pullGitSync, resolveGitSyncConflict, } from "./api.js";
import { gitSyncMessages } from "./page.messages.js";
/** The Git sync screen: what each target did last, "Pull now", the conflicts with a diff, and the token and webhook secret. */
export function GitSyncPage() {
    const site = useSite();
    const t = useTranslator(gitSyncMessages);
    const [tab, setTab] = useState("sync");
    const status = useQuery({
        queryKey: gitSyncKeys.status(),
        queryFn: ({ signal }) => getGitSyncStatus(site, { signal, fallback: t("load.failed") }),
    });
    const conflicts = useQuery({
        queryKey: gitSyncKeys.conflicts(),
        queryFn: ({ signal }) => listGitSyncConflicts(site, { signal, fallback: t("conflicts.loadFailed") }),
    });
    const conflictCount = conflicts.data?.items.length ?? 0;
    return (_jsx("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden", children: _jsxs(Tabs, { value: tab, onValueChange: (value) => setTab(value), className: "flex min-h-0 flex-1 flex-col gap-0", children: [_jsxs(PageTabs, { children: [_jsxs(TabsTrigger, { value: "sync", className: "flex-none px-0 text-xs", children: [_jsx(GitBranch, { "aria-hidden": true }), t("tab.sync")] }), _jsxs(TabsTrigger, { value: "conflicts", className: "flex-none px-0 text-xs", children: [_jsx(TriangleAlert, { "aria-hidden": true }), t("tab.conflicts"), conflictCount > 0 && _jsx(Badge, { variant: "destructive", children: conflictCount })] }), _jsxs(TabsTrigger, { value: "settings", className: "flex-none px-0 text-xs", children: [_jsx(KeyRound, { "aria-hidden": true }), t("tab.settings")] })] }), _jsx(TabsContent, { value: "sync", className: "min-h-0 flex-1 overflow-auto", children: _jsx(SyncTab, { status: status.data, error: status.error && !status.data ? errorText(site, status.error, t("load.failed")) : null, loading: status.isPending, onRetry: () => void status.refetch() }) }), _jsx(TabsContent, { value: "conflicts", className: "min-h-0 flex-1 overflow-auto", children: _jsx(ConflictsTab, { items: conflicts.data?.items, error: conflicts.error && !conflicts.data ? errorText(site, conflicts.error, t("conflicts.loadFailed")) : null, loading: conflicts.isPending }) }), _jsx(TabsContent, { value: "settings", className: "min-h-0 flex-1 overflow-auto", children: _jsx(SettingsTab, { status: status.data }) })] }) }));
}
function ListSkeleton() {
    return (_jsxs("div", { className: "space-y-3 p-5", "aria-hidden": true, children: [_jsx(Skeleton, { className: "h-24 w-full" }), _jsx(Skeleton, { className: "h-24 w-full" })] }));
}
// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Sync tab
function SyncTab({ status, error, loading, onRetry, }) {
    const t = useTranslator(gitSyncMessages);
    const pull = useCmsMutation({
        fn: (target, { site }) => pullGitSync(site, target, t("pull.failed")),
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
        fn: (target, { site }) => flushGitSync(site, target, t("flush.failed")),
        success: ({ results }) => t("flush.done", {
            written: results.reduce((sum, item) => sum + item.written, 0),
            removed: results.reduce((sum, item) => sum + item.removed, 0),
        }),
        failure: t("flush.failed"),
        invalidate: [gitSyncKeys.all],
    });
    if (loading)
        return _jsx(ListSkeleton, {});
    if (error)
        return _jsx(LoadErrorAlert, { className: "m-5", message: error, onRetry: onRetry });
    if (!status)
        return null;
    if (status.targets.length === 0) {
        return _jsx(EmptyState, { className: "h-full", icon: GitBranch, title: t("sync.empty") });
    }
    return (_jsxs("div", { className: "space-y-4 p-5", children: [!status.keys.token && (_jsx(Alert, { layout: "stack", children: _jsx(AlertDescription, { className: "col-start-auto", children: t("sync.noToken") }) })), status.targets.map((target) => (_jsxs(Panel, { role: "region", "aria-label": target.id, className: "space-y-3 p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("h2", { className: "min-w-0 flex-1 truncate font-medium text-sm", children: [target.repo, _jsxs("span", { className: "text-cms-muted-foreground", children: ["@", target.branch] })] }), _jsxs(Badge, { variant: "secondary", children: [target.mode === "pr" ? _jsx(GitPullRequest, { "aria-hidden": true }) : _jsx(GitBranch, { "aria-hidden": true }), t(`target.mode.${target.mode}`)] }), _jsxs(Button, { type: "button", size: "sm", variant: "outline", disabled: pull.isPending, onClick: () => pull.mutate(target.id), children: [_jsx(RefreshCw, { "aria-hidden": true }), t("pull.now")] }), target.queued > 0 && (_jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: flush.isPending, onClick: () => flush.mutate(target.id), children: t("flush.now") }))] }), _jsxs("dl", { className: "grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs", children: [_jsx("dt", { className: "text-cms-muted-foreground", children: t("target.folder") }), _jsx("dd", { className: "font-mono", children: target.folder || t("target.wholeRepo") }), _jsx("dt", { className: "text-cms-muted-foreground", children: t("target.path") }), _jsx("dd", { className: "font-mono", children: target.path }), _jsx("dt", { className: "text-cms-muted-foreground", children: t("target.format") }), _jsx("dd", { className: "font-mono", children: target.format }), _jsx("dt", { className: "text-cms-muted-foreground", children: t("target.collections") }), _jsx("dd", { children: target.collections.join(", ") }), _jsx("dt", { className: "text-cms-muted-foreground", children: t("target.lastPull") }), _jsx("dd", { children: target.lastPull
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
                                        }), target.lastFlush.pullRequestUrl && (_jsxs(_Fragment, { children: [" · ", _jsx("a", { className: "underline", href: target.lastFlush.pullRequestUrl, target: "_blank", rel: "noreferrer", children: t("target.pullRequest") })] })), target.lastFlush.note && (_jsx("span", { className: "block text-cms-muted-foreground", children: target.lastFlush.note }))] })) : (t("target.never")) })] }), _jsxs("div", { className: "flex flex-wrap gap-2 text-xs", children: [_jsx(Badge, { variant: "outline", children: t("target.synced", { count: target.synced }) }), target.queued > 0 && _jsx(Badge, { variant: "outline", children: t("target.queued", { count: target.queued }) }), target.conflicts > 0 && (_jsx(Badge, { variant: "destructive", children: t("target.conflicts", { count: target.conflicts }) }))] }), target.lastPull && target.lastPull.errors.length > 0 && (_jsxs("div", { className: "space-y-1 text-xs", children: [_jsx("h3", { className: "font-medium", children: t("summary.errors") }), _jsx("ul", { className: "space-y-0.5", children: target.lastPull.errors.map((item) => (_jsxs("li", { className: "text-cms-destructive-foreground", children: [_jsx("span", { className: "font-mono", children: item.path }), ": ", item.message] }, item.path))) })] })), target.lastPull && target.lastPull.skipped.length > 0 && (_jsxs("div", { className: "space-y-1 text-xs", children: [_jsx("h3", { className: "font-medium", children: t("summary.skipped") }), _jsx("ul", { className: "space-y-0.5 text-cms-muted-foreground", children: target.lastPull.skipped.map((item) => (_jsxs("li", { children: [_jsx("span", { className: "font-mono", children: item.path }), ": ", item.reason] }, item.path))) })] }))] }, target.id)))] }));
}
// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Conflicts tab
const LINE_STYLE = {
    same: "text-cms-muted-foreground",
    remove: "bg-cms-destructive-soft text-cms-destructive-foreground",
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
function ConflictsTab({ items, error, loading, }) {
    const t = useTranslator(gitSyncMessages);
    const { confirm, dialog } = useConfirm();
    const resolve = useCmsMutation({
        fn: (params, { site }) => resolveGitSyncConflict(site, params.conflict, params.resolution, t("conflicts.resolve.failed")),
        success: (_result, params) => t(`conflicts.resolved.${params.resolution}`),
        failure: t("conflicts.resolve.failed"),
        invalidate: [gitSyncKeys.all],
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
        return _jsx(LoadErrorAlert, { className: "m-5", message: error });
    if (!items || items.length === 0) {
        return _jsx(EmptyState, { className: "h-full", icon: GitBranch, title: t("conflicts.empty") });
    }
    return (_jsxs("div", { className: "space-y-4 p-5", children: [items.map((conflict) => (_jsxs(Panel, { role: "region", "aria-label": conflict.label, className: "space-y-3 p-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h2", { className: "font-medium text-sm", children: conflict.label }), _jsxs("p", { className: "text-cms-muted-foreground text-xs", children: [_jsx("span", { className: "font-mono", children: conflict.path }), " \u00B7 ", conflict.repo] }), _jsx("p", { className: "text-xs", children: t(`conflicts.reason.${conflict.reason}`) })] }), _jsx(ConflictDiff, { serverText: conflict.serverText, gitText: conflict.gitText }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: resolve.isPending, onClick: () => void decide(conflict, "git"), children: t("conflicts.useGit") }), _jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: resolve.isPending, onClick: () => void decide(conflict, "server"), children: t("conflicts.useServer") })] })] }, conflict.id))), dialog] }));
}
// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Settings tab
/** A random secret for the webhook, as hex. */
const generateSecret = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};
const keyHint = (key) => `${key.name}${key.tail ? ` ••••${key.tail}` : ""}`;
const keyState = (key) => (!key ? "unset" : key.readable ? "set" : "unreadable");
function SettingsTab({ status }) {
    const t = useTranslator(gitSyncMessages);
    const tc = useTranslator(commonMessages);
    // What the token field shows until it is changed: the key the token uses now, or an empty new key.
    const [picked, setPicked] = useState(null);
    // The webhook secret as typed or generated. It is shown only here, before it is saved: afterwards the store keeps it encrypted.
    const [secret, setSecret] = useState("");
    const [revealed, setRevealed] = useState(false);
    // Both secrets are keys of the API key store assigned to the plugin's slots. A token is followed by the server (the slot's `onChange`), so what waited for one goes out.
    const assign = useCmsMutation({
        fn: (values, { site }) => assignGitSyncKey(site, values, tc("saveFailed")),
        success: tc("saved"),
        failure: tc("saveFailed"),
        // A key may have been added to the store, and the key's uses changed.
        invalidate: [apiKeysKeys.all, gitSyncKeys.all],
        onSuccess: (_result, values) => {
            if (values.slot === "token")
                setPicked(null);
            else
                setSecret("");
        },
    });
    if (!status)
        return _jsx(ListSkeleton, {});
    const { keys } = status;
    const webhookUrl = `${typeof window === "undefined" ? "" : window.location.origin}${cmsApiUrl("/v1/git-sync/webhook")}`;
    const tokenKey = keys.token;
    const savedChoice = tokenKey ? { use: "saved", keyId: tokenKey.id } : { use: "new", value: "" };
    const choice = picked ?? savedChoice;
    // Nothing to save while the field shows the key the token already uses.
    const tokenChanged = choice.use === "new" || (choice.use === "saved" && choice.keyId !== tokenKey?.id);
    const secretKey = keys.webhookSecret;
    return (_jsxs("div", { className: "max-w-2xl space-y-8 p-5", children: [!keys.secretsAvailable && (_jsx(Alert, { variant: "destructive", layout: "stack", children: _jsx(AlertDescription, { className: "col-start-auto", children: t("settings.secretMissing") }) })), _jsxs("form", { className: "space-y-2", onSubmit: (event) => {
                    event.preventDefault();
                    if (tokenChanged && choiceReady(choice))
                        assign.mutate({ slot: "token", key: choice });
                }, children: [_jsx("p", { className: "font-medium text-sm", children: t("settings.token") }), _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("settings.token.help") }), _jsx("p", { className: "text-xs", children: t(`settings.token.state.${keyState(tokenKey)}`, { hint: tokenKey ? keyHint(tokenKey) : "" }) }), _jsx(ApiKeyField, { label: t("settings.token"), baseName: "GitHub", value: choice, onChange: setPicked }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", size: "sm", disabled: !keys.secretsAvailable || !tokenChanged || !choiceReady(choice) || assign.isPending, children: tc("save") }), tokenKey && (_jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: assign.isPending, onClick: () => assign.mutate({ slot: "token", key: { use: "none" } }), children: t("settings.remove") }))] })] }), _jsxs("form", { className: "space-y-2", onSubmit: (event) => {
                    event.preventDefault();
                    if (secret.trim())
                        assign.mutate({ slot: "webhook-secret", key: { use: "new", value: secret.trim() } });
                }, children: [_jsx(FieldLabel, { htmlFor: "git-sync-secret", className: "font-medium text-sm", children: t("settings.webhook") }), _jsx("p", { className: "text-xs", children: t(`settings.webhook.state.${keyState(secretKey)}`, { hint: secretKey ? keyHint(secretKey) : "" }) }), _jsxs(Field, { className: "gap-1", children: [_jsx(FieldLabel, { htmlFor: "git-sync-url", className: "text-cms-muted-foreground text-xs", children: t("settings.webhook.url") }), _jsx(Input, { id: "git-sync-url", readOnly: true, value: webhookUrl, className: "font-mono text-xs" })] }), _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("settings.webhook.help") }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Input, { id: "git-sync-secret", type: revealed ? "text" : "password", autoComplete: "off", spellCheck: false, value: secret, placeholder: t("settings.webhook.new"), onChange: (event) => setSecret(event.target.value), className: "min-w-0 flex-1 font-mono" }), _jsx(Button, { type: "button", size: "sm", variant: "outline", onClick: () => {
                                    setSecret(generateSecret());
                                    // A generated value has to be seen once: it goes into GitHub, and the store does not show it again.
                                    setRevealed(true);
                                }, children: t("settings.generate") }), _jsx(Button, { type: "button", size: "sm", variant: "outline", onClick: () => setRevealed((shown) => !shown), children: revealed ? t("settings.hide") : t("settings.show") }), _jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: !secret, onClick: () => void navigator.clipboard.writeText(secret).then(() => toast.success(t("settings.copied")), () => toast.error(tc("copyFailed"))), children: t("settings.copy") })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", size: "sm", disabled: !keys.secretsAvailable || !secret.trim() || assign.isPending, children: tc("save") }), secretKey && (_jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: assign.isPending, onClick: () => assign.mutate({ slot: "webhook-secret", key: { use: "none" } }), children: t("settings.remove") }))] })] })] }));
}
