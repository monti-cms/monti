"use client";

import type { TextChecker, TextIssueSeverity } from "@monti-cms/core/client";
import { createTranslator } from "@monti-cms/core/client";
import { posToDOMRect } from "@tiptap/core";
import { CircleAlert, EyeOff, Info, Loader2, type LucideIcon, SpellCheck, TriangleAlert } from "lucide-react";
import { useMemo, useRef } from "react";
import { cn } from "../../lib/utils/cn";
import { useIconByName } from "../../screens/shared/collection-icon";
import { Button } from "../../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import { IconButton } from "../../ui/icon-button";
import { Popover, PopoverContent } from "../../ui/popover";
import { textCheckMessages } from "./messages";
import { textCheckIssues } from "./plugin";
import type { DocTextIssue } from "./run";
import type { TextCheckController } from "./use-text-check";

const t = createTranslator(textCheckMessages);

const SEVERITY_ICON: Readonly<Record<TextIssueSeverity, { icon: LucideIcon; className: string }>> = {
	error: { icon: CircleAlert, className: "text-cms-destructive" },
	warning: { icon: TriangleAlert, className: "text-cms-warning" },
	info: { icon: Info, className: "text-cms-primary" },
};

function SeverityIcon({ severity }: { severity: TextIssueSeverity }) {
	const { icon: Icon, className } = SEVERITY_ICON[severity];
	return <Icon aria-hidden className={cn("size-4 shrink-0", className)} />;
}

/** 검사기 버튼 하나. 이름·아이콘은 검사기 정의(`label`·`icon`)에서 온다. */
function CheckerButton({ checker, controller }: { checker: TextChecker; controller: TextCheckController }) {
	const iconByName = useIconByName();
	const Icon = (typeof checker.icon === "string" ? iconByName(checker.icon) : checker.icon) ?? SpellCheck;
	const running = controller.running === checker.id;
	return (
		<IconButton
			label={running ? t("running") : checker.label}
			side="bottom"
			disabled={controller.running !== null || !controller.editor.isEditable}
			// 고른 글자를 잃지 않게 편집기 초점을 지킨다.
			onMouseDown={(event) => event.preventDefault()}
			onClick={() => void controller.run(checker.id)}
		>
			{running ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Icon aria-hidden className="size-4" />}
		</IconButton>
	);
}

/** 도구 모음의 검사기 버튼(검사기마다 하나)과 결과 수(누르면 결과 목록). */
export function TextCheckToolbar({ controller }: { controller: TextCheckController }) {
	const { issues } = controller;
	const count = issues.length;
	return (
		<div className="flex items-center gap-0.5">
			{controller.checkers.map((checker) => (
				<CheckerButton key={checker.id} checker={checker} controller={controller} />
			))}
			{count > 0 && (
				<DropdownMenu>
					<IconButton
						label={t("results")}
						side="bottom"
						size="sm"
						className="h-8 min-w-8 px-1.5"
						onMouseDown={(event) => event.preventDefault()}
						trigger={(button) => <DropdownMenuTrigger render={button} />}
					>
						<span className="tabular rounded-full bg-cms-muted px-1.5 font-medium text-xs leading-5">
							{count > 99 ? "99+" : count}
						</span>
					</IconButton>
					<DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
						{issues.map((issue) => (
							<DropdownMenuItem key={issue.key} className="items-start" onClick={() => controller.jump(issue)}>
								<SeverityIcon severity={issue.severity} />
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate font-medium">{issue.text.trim() || issue.message}</span>
									{issue.message && <span className="truncate text-cms-muted-foreground text-xs">{issue.message}</span>}
								</span>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}

/** 밑줄을 누르거나 목록에서 고르면 그 자리에 뜨는 결과 창: 설명, 바꿀 글 후보, 무시. */
export function TextIssuePopover({ controller }: { controller: TextCheckController }) {
	const { editor, open, issues, pluginKey } = controller;
	const issue = open ? issues.find((item) => item.key === open.key) : undefined;
	const key = issue?.key;
	// 목록(키보드)에서 연 창은 닫을 때 초점을 본문으로 돌려준다. 밑줄을 눌러 연 창은 초점을 옮기지 않았다.
	const returnFocusRef = useRef(false);
	if (open) returnFocusRef.current = open.focus;
	// 밑줄은 다시 그려질 수 있어 DOM 요소 대신 지금 문서 위치로 자리를 잰다.
	const anchor = useMemo(
		() =>
			key
				? {
						getBoundingClientRect: () => {
							const current = textCheckIssues(editor.state, pluginKey).find((item) => item.key === key);
							if (!current || editor.isDestroyed) return new DOMRect();
							try {
								return posToDOMRect(editor.view, current.from, current.to);
							} catch {
								return new DOMRect();
							}
						},
					}
				: null,
		[editor, key, pluginKey],
	);
	return (
		<Popover
			open={!!issue}
			onOpenChange={(next) => {
				if (!next) controller.close();
			}}
		>
			<PopoverContent
				anchor={anchor}
				side="bottom"
				align="start"
				initialFocus={open?.focus ?? false}
				finalFocus={() => (returnFocusRef.current ? (editor.view.dom as HTMLElement) : false)}
				aria-label={t("results")}
				className="w-72 gap-3 p-3"
			>
				{issue && <IssueCard controller={controller} issue={issue} />}
			</PopoverContent>
		</Popover>
	);
}

function IssueCard({ controller, issue }: { controller: TextCheckController; issue: DocTextIssue }) {
	const checker = controller.checkers.find((item) => item.id === issue.checkerId);
	const editable = controller.editor.isEditable;
	return (
		<>
			<div className="flex items-start gap-2">
				<SeverityIcon severity={issue.severity} />
				<p className="min-w-0 flex-1 text-sm">{issue.message || issue.text}</p>
			</div>
			{issue.suggestions.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{issue.suggestions.slice(0, 6).map((suggestion) => (
						<Button
							key={suggestion}
							type="button"
							variant="outline"
							size="sm"
							disabled={!editable}
							className="max-w-full"
							onClick={() => controller.apply(issue, suggestion)}
						>
							<span className="truncate">{suggestion || t("delete")}</span>
						</Button>
					))}
				</div>
			)}
			<div className="flex items-center gap-2">
				<span className="min-w-0 flex-1 truncate text-cms-muted-foreground text-xs">
					{checker?.label ?? issue.source}
				</span>
				{issue.url && (
					<a
						href={issue.url}
						target="_blank"
						rel="noreferrer noopener"
						className="text-cms-primary text-xs underline-offset-2 hover:underline"
					>
						{t("explain")}
					</a>
				)}
				<Button type="button" variant="ghost" size="sm" onClick={() => controller.ignore(issue)}>
					<EyeOff aria-hidden className="size-4" />
					{t("ignore")}
				</Button>
			</div>
		</>
	);
}
