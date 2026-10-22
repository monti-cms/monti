"use client";

import {
	CODE_CHAR_EFFECTS,
	type CodeCharEffectName,
	type CodeRule,
	checkPattern,
	escapePattern,
	newEffectId,
	ruleMatches,
} from "@monti-cms/core/code-block";
import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Button,
	IconButton,
	Inline,
	Input,
	Label,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	Switch,
	Text,
	Textarea,
} from "@monti-cms/ui";
import { Plus, Regex, Trash2 } from "lucide-react";
import { useSlot } from "../../slots/slots";
import type { TranslatorFor } from "../../translator";
import { codeBlockMessages } from "./messages";

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
function effectOptions(site: Site, current?: string) {
	return CODE_CHAR_EFFECTS.filter((effect) => site.offersCharEffect(effect.name) || effect.name === current).map(
		(effect) => ({
			value: effect.name,
			label: effect.label,
		}),
	);
}

/** Effect a new rule starts with: the first offered one (`undefined` when none is offered, so adding a rule is not offered). */
const defaultEffect = (site: Site): CodeCharEffectName | undefined =>
	CODE_CHAR_EFFECTS.find((effect) => site.offersCharEffect(effect.name))?.name;
const SCOPE_OPTIONS = (t: TranslatorFor<typeof codeBlockMessages>) => [
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
	const site = useSite();
	const t = useTranslator(codeBlockMessages);
	const problem = checkPattern(rule.pattern, rule.flags);
	const count = problem ? 0 : ruleMatches(rule, text).length;
	const options = effectOptions(site, rule.name);
	return (
		<Stack
			as="li"
			gap="condensed"
			padding="condensed"
			border="all"
			radius="md"
			aria-label={t("rulesPanel.rule", { pattern: rule.pattern })}
		>
			<Inline gap="condensed">
				<Select
					value={rule.name}
					items={options}
					onValueChange={(value) => value && onChange({ ...rule, name: value as CodeCharEffectName, attrs: {} })}
				>
					<SelectTrigger size="sm" aria-label={t("rulesPanel.effect")}>
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
					items={SCOPE_OPTIONS(t)}
					onValueChange={(value) =>
						value &&
						onChange(
							value === "document"
								? { ...rule, scope: "document", line: undefined }
								: { ...rule, scope: "char", line: rule.line ?? 0 },
						)
					}
				>
					<SelectTrigger size="sm" aria-label={t("rulesPanel.scope")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SCOPE_OPTIONS(t).map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{rule.scope === "char" && (
					<Input
						aria-label={t("rulesPanel.lineNumber")}
						size="sm"
						type="number"
						min={1}
						max={lineCount}
						value={(rule.line ?? 0) + 1}
						onChange={(event) => {
							const line = Math.min(lineCount, Math.max(1, Number(event.target.value) || 1)) - 1;
							onChange({ ...rule, line });
						}}
					/>
				)}
				<Inline grow justify="end">
					<IconButton label={t("rulesPanel.remove")} size="icon-xs" tone="danger" onClick={onRemove}>
						<Trash2 aria-hidden />
					</IconButton>
				</Inline>
			</Inline>
			<Inline gap="tight">
				<Text variant="caption" tone="muted" mono>
					/
				</Text>
				<Input
					aria-label={t("rulesPanel.pattern")}
					value={rule.pattern}
					placeholder={t("rulesPanel.patternPlaceholder")}
					onChange={(event) => onChange({ ...rule, pattern: event.target.value })}
					size="sm"
					mono
					aria-invalid={!!problem && rule.pattern.length > 0}
				/>
				<Text variant="caption" tone="muted" mono>
					/
				</Text>
				<Input
					aria-label={t("rulesPanel.flags")}
					value={rule.flags}
					onChange={(event) => onChange({ ...rule, flags: event.target.value.replace(/[^a-z]/gi, "") })}
					size="sm"
					mono
				/>
			</Inline>
			{rule.name === "Tooltip" && (
				<Textarea
					aria-label={t("rulesPanel.tooltipContent")}
					value={String(rule.attrs.content ?? "")}
					placeholder={t("rulesPanel.tooltipContent")}
					rows={1}
					size="sm"
					onChange={(event) => onChange({ ...rule, attrs: { ...rule.attrs, content: event.target.value } })}
				/>
			)}
			{rule.name === "fold" && (
				<Label htmlFor={`${rule.id}-open`} size="caption">
					<Switch
						id={`${rule.id}-open`}
						size="sm"
						checked={rule.attrs.open === true}
						onCheckedChange={(checked) => onChange({ ...rule, attrs: { ...rule.attrs, open: checked || undefined } })}
					/>
					{t("rulesPanel.openFromStart")}
				</Label>
			)}
			<Text as="p" variant="caption" tone={problem && rule.pattern ? "danger" : "muted"}>
				{problem ? (rule.pattern ? problem : t("rulesPanel.enterPattern")) : t("rulesPanel.matches", { count })}
			</Text>
		</Stack>
	);
}

/**
 * List of regex rules (`// @document fold {re:/.../}`, etc.). Even if the code is edited, rules find and apply the effect again.
 * If text is picked, "Add rule" starts as a rule that finds that text.
 */
export function RulesPanel({ rules, text, lineCount, selection, language, slotScope, onChange }: RulesPanelProps) {
	const site = useSite();
	const t = useTranslator(codeBlockMessages);
	const newEffect = defaultEffect(site);
	// Adding is offered only while the tool is on and at least one text effect is offered. Existing rules stay editable and removable either way.
	const canAdd = site.CODE_BLOCK_FEATURES.rules && newEffect !== undefined;
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
				variant={rules.length > 0 ? "ghost" : "quiet"}
				trigger={(button) => <PopoverTrigger render={button} />}
			>
				<Regex aria-hidden />
				{rules.length > 0 && <Text variant="caption">{rules.length}</Text>}
			</IconButton>
			<PopoverContent align="end" width="lg" scroll data-code-ui="">
				<Inline justify="between" gap="condensed">
					<Text as="p" weight="semibold">
						{t("rulesPanel.title")}
					</Text>
					{canAdd && site.offersCharEffect("fold") && foldSlot.trigger}
				</Inline>
				{canAdd && site.offersCharEffect("fold") && foldSlot.panel}
				{rules.length > 0 && (
					<Stack as="ul" gap="condensed">
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
					</Stack>
				)}
				{canAdd && (
					<Inline justify="start">
						<Button type="button" variant="outline" size="sm" onClick={addRule}>
							<Plus aria-hidden />
							{selection?.text ? t("rulesPanel.addFromSelection") : t("rulesPanel.add")}
						</Button>
					</Inline>
				)}
			</PopoverContent>
		</Popover>
	);
}
