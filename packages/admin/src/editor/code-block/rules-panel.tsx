"use client";

import { createTranslator } from "@monti-cms/core/client";
import {
	CODE_BLOCK_FEATURES,
	CODE_CHAR_EFFECTS,
	type CodeCharEffectName,
	type CodeRule,
	checkPattern,
	escapePattern,
	newEffectId,
	offersCharEffect,
	ruleMatches,
} from "@monti-cms/core/code-block";
import { Plus, Regex, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils/cn";
import { useSlot } from "../../slots/slots";
import { Button } from "../../ui/button";
import { IconButton } from "../../ui/icon-button";
import { Input } from "../../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Switch } from "../../ui/switch";
import { Textarea } from "../../ui/textarea";
import { codeBlockMessages } from "./messages";

const t = createTranslator(codeBlockMessages);

interface RulesPanelProps {
	rules: CodeRule[];
	text: string;
	lineCount: number;
	/** The text picked in this code block now and its line (initial value of a new rule). */
	selection: { text: string } | null;
	/** Code language (passed to the placeholder behavior). */
	language?: string | null;
	/** Value pointing to this code block. Even if the panel is closed, the AI result stays on this block. */
	slotScope?: string;
	onChange: (next: CodeRule[]) => void;
}

/**
 * Effects a rule can use in the dropdown: the ones the editor offers, plus the rule's current effect when it is not offered
 * (a body written before the tool was turned off keeps showing it, and still saves it unchanged).
 */
function effectOptions(current?: string) {
	return CODE_CHAR_EFFECTS.filter((effect) => offersCharEffect(effect.name) || effect.name === current).map(
		(effect) => ({
			value: effect.name,
			label: effect.label,
		}),
	);
}

/** Effect a new rule starts with: the first offered one (`undefined` when none is offered, so adding a rule is not offered). */
const defaultEffect = (): CodeCharEffectName | undefined =>
	CODE_CHAR_EFFECTS.find((effect) => offersCharEffect(effect.name))?.name;
const SCOPE_OPTIONS = [
	{ value: "document", label: t("rulesPanel.scopeDocument") },
	{ value: "line", label: t("rulesPanel.scopeLine") },
];

function RuleRow({
	rule,
	text,
	lineCount,
	onChange,
	onRemove,
}: {
	rule: CodeRule;
	text: string;
	lineCount: number;
	onChange: (rule: CodeRule) => void;
	onRemove: () => void;
}) {
	const problem = checkPattern(rule.pattern, rule.flags);
	const count = problem ? 0 : ruleMatches(rule, text).length;
	const options = effectOptions(rule.name);
	return (
		<li
			className="flex flex-col gap-1.5 rounded-md border p-2"
			aria-label={t("rulesPanel.rule", { pattern: rule.pattern })}
		>
			<div className="flex items-center gap-1.5">
				<Select
					value={rule.name}
					items={options}
					onValueChange={(value) => value && onChange({ ...rule, name: value as CodeCharEffectName, attrs: {} })}
				>
					<SelectTrigger size="sm" className="h-7 text-xs" aria-label={t("rulesPanel.effect")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={rule.scope === "document" ? "document" : "line"}
					items={SCOPE_OPTIONS}
					onValueChange={(value) =>
						value &&
						onChange(
							value === "document"
								? { ...rule, scope: "document", line: undefined }
								: { ...rule, scope: "char", line: rule.line ?? 0 },
						)
					}
				>
					<SelectTrigger size="sm" className="h-7 text-xs" aria-label={t("rulesPanel.scope")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SCOPE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{rule.scope === "char" && (
					<Input
						aria-label={t("rulesPanel.lineNumber")}
						type="number"
						min={1}
						max={lineCount}
						value={(rule.line ?? 0) + 1}
						onChange={(event) => {
							const line = Math.min(lineCount, Math.max(1, Number(event.target.value) || 1)) - 1;
							onChange({ ...rule, line });
						}}
						className="h-7 w-14 px-1.5 text-xs"
					/>
				)}
				<IconButton label={t("rulesPanel.remove")} size="icon-xs" destructive onClick={onRemove} className="ml-auto">
					<Trash2 aria-hidden />
				</IconButton>
			</div>
			<div className="flex items-center gap-1 font-mono text-xs">
				<span className="text-cms-muted-foreground">/</span>
				<Input
					aria-label={t("rulesPanel.pattern")}
					value={rule.pattern}
					placeholder={t("rulesPanel.patternPlaceholder")}
					onChange={(event) => onChange({ ...rule, pattern: event.target.value })}
					className="h-7 flex-1 px-1.5 font-mono text-xs"
					aria-invalid={!!problem && rule.pattern.length > 0}
				/>
				<span className="text-cms-muted-foreground">/</span>
				<Input
					aria-label={t("rulesPanel.flags")}
					value={rule.flags}
					onChange={(event) => onChange({ ...rule, flags: event.target.value.replace(/[^a-z]/gi, "") })}
					className="h-7 w-10 px-1.5 font-mono text-xs"
				/>
			</div>
			{rule.name === "Tooltip" && (
				<Textarea
					aria-label={t("rulesPanel.tooltipContent")}
					value={String(rule.attrs.content ?? "")}
					placeholder={t("rulesPanel.tooltipContent")}
					rows={1}
					onChange={(event) => onChange({ ...rule, attrs: { ...rule.attrs, content: event.target.value } })}
					className="min-h-7 px-1.5 py-1 text-xs md:text-xs"
				/>
			)}
			{rule.name === "fold" && (
				<label htmlFor={`${rule.id}-open`} className="flex items-center gap-2 text-xs">
					<Switch
						id={`${rule.id}-open`}
						size="sm"
						checked={rule.attrs.open === true}
						onCheckedChange={(checked) => onChange({ ...rule, attrs: { ...rule.attrs, open: checked || undefined } })}
					/>
					{t("rulesPanel.openFromStart")}
				</label>
			)}
			<p className={cn("text-[11px]", problem && rule.pattern ? "text-cms-destructive" : "text-cms-muted-foreground")}>
				{problem ? (rule.pattern ? problem : t("rulesPanel.enterPattern")) : t("rulesPanel.matches", { count })}
			</p>
		</li>
	);
}

/**
 * List of regex rules (`// @document fold {re:/.../}`, etc.). Even if the code is edited, rules find and apply the effect again.
 * If text is picked, "Add rule" starts as a rule that finds that text.
 */
export function RulesPanel({ rules, text, lineCount, selection, language, slotScope, onChange }: RulesPanelProps) {
	const newEffect = defaultEffect();
	// Adding is offered only while the tool is on and at least one text effect is offered. Existing rules stay editable and removable either way.
	const canAdd = CODE_BLOCK_FEATURES.rules && newEffect !== undefined;
	// Code block rules spot. Clicking a candidate regex adds it as a char collapse rule.
	const foldSlot = useSlot({
		slot: "codeRules",
		target: "fold",
		scope: slotScope,
		getContext: () => ({ code: text, language: language ?? undefined }),
		apply: (pattern) =>
			onChange([...rules, { id: newEffectId(), scope: "document", name: "fold", pattern, flags: "g", attrs: {} }]),
	});
	const addRule = () =>
		newEffect &&
		onChange([
			...rules,
			{
				id: newEffectId(),
				scope: "document",
				name: newEffect,
				pattern: selection?.text ? escapePattern(selection.text) : "",
				flags: "g",
				attrs: {},
			},
		]);

	return (
		<Popover>
			<IconButton
				label={t("rulesPanel.title")}
				size="sm"
				className={cn("h-7 min-w-7 gap-1 px-1.5 text-xs", rules.length > 0 && "text-cms-foreground")}
				trigger={(button) => <PopoverTrigger render={button} />}
			>
				<Regex aria-hidden className="size-3.5" />
				{rules.length > 0 && <span className="tabular-nums">{rules.length}</span>}
			</IconButton>
			<PopoverContent align="end" className="w-96 gap-2 p-3 text-xs" data-code-ui="">
				<div className="flex items-center justify-between gap-2">
					<p className="font-semibold">{t("rulesPanel.title")}</p>
					{canAdd && offersCharEffect("fold") && foldSlot.trigger}
				</div>
				{canAdd && offersCharEffect("fold") && foldSlot.panel}
				{rules.length > 0 && (
					<ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
						{rules.map((rule) => (
							<RuleRow
								key={rule.id}
								rule={rule}
								text={text}
								lineCount={lineCount}
								onChange={(next) => onChange(rules.map((item) => (item.id === rule.id ? next : item)))}
								onRemove={() => onChange(rules.filter((item) => item.id !== rule.id))}
							/>
						))}
					</ul>
				)}
				{canAdd && (
					<Button type="button" variant="outline" size="sm" onClick={addRule} className="self-start">
						<Plus aria-hidden />
						{selection?.text ? t("rulesPanel.addFromSelection") : t("rulesPanel.add")}
					</Button>
				)}
			</PopoverContent>
		</Popover>
	);
}
