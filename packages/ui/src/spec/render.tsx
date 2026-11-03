import { createElement, type ReactNode } from "react";
import { cn } from "../cn";
import { type Catalog, checkSpec } from "./check";
import {
	isAction,
	isData,
	isItem,
	isSpacing,
	isText,
	type ScreenSpecDocument,
	type SpecChild,
	type SpecElement,
	type SpecValue,
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

/**
 * A list or object a prop takes from the data holds only the fields the catalog names for it, each a plain value: what a screen shows, never a width, a
 * color or a part of its own.
 */
function checkData(value: unknown, fields: readonly string[], where: string) {
	for (const each of Array.isArray(value) ? value : [value]) {
		if (each === undefined || each === null) continue;
		if (typeof each !== "object")
			throw new ScreenSpecError(`${where}: the data gave ${JSON.stringify(each)}, not an item`);
		for (const [field, inside] of Object.entries(each)) {
			if (!fields.includes(field)) {
				throw new ScreenSpecError(
					`${where}: the data has "${field}", which is not one of its fields (${fields.join(", ")})`,
				);
			}
			if (inside !== null && typeof inside === "object") {
				throw new ScreenSpecError(`${where}.${field}: the data gave an object, not a plain value`);
			}
		}
	}
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

	/** What a value reads: `item` is the item of the repeated element it sits in, if any. */
	const resolve = (value: SpecValue, item: unknown, where: string): unknown => {
		if (isData(value)) return read(data, value.data);
		if (isItem(value)) return read(item as ScreenSpecProps["data"], value.item);
		if (isText(value)) {
			const params = Object.fromEntries(
				Object.entries(value.params ?? {}).map(([name, param]) => [
					name,
					typeof param === "object" ? String(resolve(param, item, where) ?? "") : param,
				]),
			);
			const found = text(value.text, params);
			if (found === undefined) throw new ScreenSpecError(`${where}: the dictionary has no text "${value.text}"`);
			return found;
		}
		if (isAction(value)) {
			const address = actions[value.action];
			if (address === undefined) throw new ScreenSpecError(`${where}: the page gave no action "${value.action}"`);
			return address;
		}
		return value;
	};
	const shows = (visible: Visible | undefined, item: unknown): boolean => {
		if (visible === undefined) return true;
		if ("not" in visible) return !shows(visible.not, item);
		const value = resolve(visible, item, "visible");
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
		// Only a container that is there for its padding: one child, at least one Spacing, and no layout of its own but its direction.
		const onlyPadding =
			ids.length === 1 &&
			(element.children ?? []).length > 1 &&
			Object.keys(element.props ?? {}).every((name) => name === "direction");
		if (element.type !== "Stack" || !onlyPadding || element.visible !== undefined) return undefined;
		const inner = elementOf(ids[0] as string);
		const direction = (element.props?.direction ?? "column") as Direction;
		const innerDirection = (inner.props?.direction ?? "column") as Direction;
		return inner.type === "Stack" &&
			inner.visible === undefined &&
			inner.repeat === undefined &&
			innerDirection !== direction
			? ids[0]
			: undefined;
	};

	/** Draws an element, once for each item of its list when it repeats. `key` tells apart the copies of a repeated element. */
	const draw = (id: string, extra: readonly (string | undefined)[], item: unknown, key: string): ReactNode => {
		const element = elementOf(id);
		if (element.repeat) {
			const items = resolve(element.repeat, item, `${id}.repeat`);
			const list = Array.isArray(items) ? items : [];
			return list.length === 0 ? null : list.map((each, index) => drawOne(id, element, extra, each, `${key}/${index}`));
		}
		return drawOne(id, element, extra, item, key);
	};

	const drawOne = (
		id: string,
		element: SpecElement,
		extra: readonly (string | undefined)[],
		item: unknown,
		key: string,
	): ReactNode => {
		if (!shows(element.visible, item)) return null;
		const part = parts[element.type as keyof typeof parts];
		if (!part) throw new ScreenSpecError(`${id}.type: there is no part "${element.type}"`);
		const children = element.children ?? [];
		const classes = [...extra];
		const childOf = (child: SpecChild, where: string): ReactNode => {
			if (typeof child === "string") return draw(child, [], item, `${key}/${child}`);
			if (isSpacing(child)) return null;
			return resolve(child, item, where) as ReactNode;
		};
		let drawn: ReactNode[];
		if (catalog[element.type]?.kind === "layout") {
			const direction = (element.props?.direction ?? "column") as Direction;
			const { container, margins } = spacingClasses(children, direction);
			const merged = mergedChild(element);
			if (merged !== undefined) return draw(merged, [...classes, ...container], item, key);
			classes.push(...container);
			// A margin is the space after the child before it, so the first child shown has none.
			let shown = false;
			drawn = children.map((child: SpecChild, index) => {
				if (typeof child !== "string") return null;
				const node = draw(child, [shown ? margins.get(index) : undefined], item, `${key}/${child}`);
				if (node !== null) shown = true;
				return node;
			});
		} else {
			drawn = children.map((child, index) => childOf(child, `${id}.children[${index}]`));
		}
		const props: Record<string, unknown> = { key };
		for (const [name, value] of Object.entries(element.props ?? {})) {
			const resolved = resolve(value, item, `${id}.props.${name}`);
			const rule = catalog[element.type]?.props[name];
			if (rule?.fields) checkData(resolved, rule.fields, `${id}.props.${name}`);
			const choices = rule?.enum;
			if (choices && resolved !== undefined && !choices.includes(resolved as string | number)) {
				throw new ScreenSpecError(`${id}.props.${name}: the data gave ${JSON.stringify(resolved)}, not a choice`);
			}
			props[name] = resolved;
		}
		for (const [slot, entries] of Object.entries(element.slots ?? {})) {
			props[slot] = entries.map((child, index) => childOf(child, `${id}.slots.${slot}[${index}]`));
		}
		const className = cn(...classes);
		if (className) props.className = className;
		return createElement(part as (props: object) => ReactNode, props, ...drawn);
	};

	return draw(spec.root, [], undefined, spec.root);
}
