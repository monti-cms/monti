import { createElement, type ReactNode } from "react";
import { cn } from "../cn";
import { type Catalog, checkSpec } from "./check";
import {
	isAction,
	isData,
	isSpacing,
	isText,
	type ScreenSpecDocument,
	type SpecChild,
	type SpecElement,
	type SpecValue,
	type TextValue,
	type Visible,
} from "./format";
import { parts } from "./parts";
import catalogJson from "./screen-catalog.generated.json";
import { type Direction, spacingClasses } from "./spacing";

const catalog = catalogJson as Catalog;

export type { ScreenSpecDocument } from "./format";

export interface ScreenSpecProps {
	readonly spec: ScreenSpecDocument;
	/** What the screen shows, read by `{ "data": "/pointer" }`. */
	readonly data?: Readonly<Record<string, unknown>>;
	/** The screen's texts in the admin's language: undefined for a key the dictionary does not have. */
	readonly text: (key: string, params: Record<string, string | number>) => string | undefined;
	/** The things the screen does by name (`signIn`), each the address its form posts to. */
	readonly actions?: Readonly<Record<string, string>>;
}

/** The specs already checked, so each is checked once however often it is drawn. */
const checked = new WeakSet<ScreenSpecDocument>();

/** A screen spec could not be drawn: a problem `checkSpec` reports, or a text or action the page did not give. */
export class ScreenSpecError extends Error {
	override name = "ScreenSpecError";
}

function read(data: ScreenSpecProps["data"], pointer: string): unknown {
	let value: unknown = data;
	for (const key of pointer.split("/").slice(1)) {
		value = value === null || typeof value !== "object" ? undefined : (value as Record<string, unknown>)[key];
	}
	return value;
}

/**
 * Draws a screen spec with the design system's parts. It has no hooks and no context, so it draws in a server component; a part that runs in the browser
 * is a client component of its own and gets only serializable props. It throws, and draws nothing, for a spec `checkSpec` finds a problem in, an
 * unknown part, a text key the dictionary does not have or an action the page did not give: a screen never draws with a piece silently missing.
 */
export function ScreenSpec({ spec, data, text, actions = {} }: ScreenSpecProps): ReactNode {
	if (!checked.has(spec)) {
		const problems = checkSpec(spec, catalog);
		if (problems.length > 0) throw new ScreenSpecError(`The screen spec has problems:\n${problems.join("\n")}`);
		checked.add(spec);
	}

	const translate = ({ text: key, params = {} }: TextValue, where: string) => {
		const values = Object.fromEntries(
			Object.entries(params).map(([name, value]) => [
				name,
				isData(value) ? String(read(data, value.data) ?? "") : value,
			]),
		);
		const found = text(key, values);
		if (found === undefined) throw new ScreenSpecError(`${where}: the dictionary has no text "${key}"`);
		return found;
	};
	const resolve = (value: SpecValue, where: string): unknown => {
		if (isData(value)) return read(data, value.data);
		if (isText(value)) return translate(value, where);
		if (isAction(value)) {
			const address = actions[value.action];
			if (address === undefined) throw new ScreenSpecError(`${where}: the page gave no action "${value.action}"`);
			return address;
		}
		return value;
	};
	const shows = (visible: Visible | undefined): boolean => {
		if (visible === undefined) return true;
		if ("not" in visible) return !shows(visible.not);
		const value = read(data, visible.data);
		return !(
			value === undefined ||
			value === null ||
			value === false ||
			value === "" ||
			(Array.isArray(value) && value.length === 0)
		);
	};
	const elementOf = (id: string): SpecElement => spec.elements[id] as SpecElement;

	/** A container whose only child is a container of the other direction, between Spacings: both are drawn as one element, its padding on both axes. */
	const mergedChild = (element: SpecElement): string | undefined => {
		const ids = (element.children ?? []).filter((child): child is string => typeof child === "string");
		if (element.type !== "Stack" || ids.length !== 1) return undefined;
		const inner = elementOf(ids[0] as string);
		const direction = (element.props?.direction ?? "column") as Direction;
		const innerDirection = (inner.props?.direction ?? "column") as Direction;
		return inner.type === "Stack" && inner.visible === undefined && innerDirection !== direction ? ids[0] : undefined;
	};

	const draw = (id: string, extra: readonly (string | undefined)[] = []): ReactNode => {
		const element = elementOf(id);
		if (!shows(element.visible)) return null;
		const part = parts[element.type as keyof typeof parts];
		if (!part) throw new ScreenSpecError(`${id}.type: there is no part "${element.type}"`);
		const children = element.children ?? [];
		const classes = [...extra];
		let drawn: ReactNode[];
		if (catalog[element.type]?.container) {
			const direction = (element.props?.direction ?? "column") as Direction;
			const { container, margins } = spacingClasses(children, direction);
			const merged = mergedChild(element);
			if (merged !== undefined) return draw(merged, [...classes, ...container]);
			classes.push(...container);
			// A margin is the space after the child before it, so the first child shown has none.
			let shown = false;
			drawn = children.map((child: SpecChild, index) => {
				if (typeof child !== "string") return null;
				const node = draw(child, [shown ? margins.get(index) : undefined]);
				if (node !== null) shown = true;
				return node;
			});
		} else {
			drawn = children.map((child, index) => {
				if (typeof child === "string") return draw(child);
				if (isSpacing(child)) return null;
				return resolve(child, `${id}.children[${index}]`) as ReactNode;
			});
		}
		const props: Record<string, unknown> = { key: id };
		for (const [name, value] of Object.entries(element.props ?? {})) {
			const resolved = resolve(value, `${id}.props.${name}`);
			const choices = catalog[element.type]?.props[name]?.enum;
			if (choices && resolved !== undefined && !choices.includes(resolved as string | number)) {
				throw new ScreenSpecError(`${id}.props.${name}: the data gave ${JSON.stringify(resolved)}, not a choice`);
			}
			props[name] = resolved;
		}
		for (const [slot, ids] of Object.entries(element.slots ?? {})) props[slot] = ids.map((child) => draw(child));
		const className = cn(...classes);
		if (className) props.className = className;
		return createElement(part as (props: object) => ReactNode, props, ...drawn);
	};

	return draw(spec.root);
}
