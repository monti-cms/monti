import { createElement, Fragment, type ReactNode } from "react";
import { type Catalog, checkSpec } from "./check";
import {
	isAction,
	isItem,
	isSpacing,
	isState,
	isTemplate,
	isText,
	refOf,
	type ScreenSpecDocument,
	type SpecChild,
	type SpecElement,
	type SpecValue,
	templateRead,
	type Visible,
} from "./format";
import { type Direction, type SpacingClassTable, spacingClasses } from "./spacing";

/**
 * What the renderer needs from a design system, and all it knows of one: its parts by the names a spec uses, its catalog (`pnpm gen:screen-catalog`),
 * the class of each spacing step, and how it joins classes. A design system's pack builds one and calls `createScreenSpec` with it.
 */
export interface ScreenPack {
	readonly parts: Readonly<Record<string, (props: never) => ReactNode>>;
	readonly catalog: Catalog;
	readonly spacing: SpacingClassTable;
	readonly join: (...classes: (string | undefined)[]) => string;
}

export type { ScreenSpecDocument } from "./format";

export interface ScreenSpecProps {
	readonly spec: ScreenSpecDocument;
	/** What the screen shows, read by `{ "state": "/pointer" }` and by `bind`. */
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
 * Makes the renderer of one design system: `ScreenSpec` draws a screen spec with that system's parts. It has no hooks and no context, so it draws in a
 * server component; a part that runs in the browser is a client component of its own and gets only serializable props. It throws, and draws nothing,
 * for a spec `checkSpec` finds a problem in, an unknown part, a text key the dictionary does not have or an action the page did not give: a screen never
 * draws with a piece silently missing.
 */
export function createScreenSpec(pack: ScreenPack) {
	const { parts, catalog, join } = pack;
	return function ScreenSpec({
		spec,
		data,
		text,
		actions = {},
		idPrefix = "spec",
	}: ScreenSpecProps & {
		/** What the ids made for references start with, so two specs on one page do not share one. */
		readonly idPrefix?: string;
	}): ReactNode {
		if (!checked.has(spec)) {
			const problems = checkSpec(spec, catalog);
			if (problems.length > 0) throw new ScreenSpecError(`The screen spec has problems:\n${problems.join("\n")}`);
			checked.add(spec);
		}

		/** The id an element referred to by `@id` gets on the page, and that a label's `for` names. */
		const domId = (id: string) => `${idPrefix}-${id}`;
		const referred = new Set<string>();
		for (const element of Object.values(spec.elements)) {
			for (const value of Object.values(element.props ?? {})) {
				const target = refOf(value);
				if (target) referred.add(target);
			}
		}

		/** What a value reads: `item` is the item of the repeated element it sits in, if any. */
		const resolve = (value: SpecValue, item: unknown, where: string): unknown => {
			if (isState(value)) return read(data, value.state);
			if (isItem(value)) return read(item as ScreenSpecProps["data"], value.item);
			const words = (key: string, values: Record<string, string | number>) => {
				const found = text(key, values);
				if (found === undefined) throw new ScreenSpecError(`${where}: the dictionary has no text "${key}"`);
				return found;
			};
			if (isText(value)) return words(value.text, {});
			if (isTemplate(value)) {
				const values = Object.fromEntries(
					Object.entries(value.values).map(([name, path]) => {
						const reads = templateRead(path);
						return [name, reads ? String(resolve(reads, item, where) ?? "") : path];
					}),
				);
				return words(value.template, values);
			}
			const target = refOf(value);
			if (target !== undefined) return domId(target);
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
			if (catalog.entries[element.type]?.kind !== "layout" || !onlyPadding || element.visible !== undefined)
				return undefined;
			const inner = elementOf(ids[0] as string);
			const direction = (element.props?.direction ?? "column") as Direction;
			const innerDirection = (inner.props?.direction ?? "column") as Direction;
			return catalog.entries[inner.type]?.kind === "layout" &&
				inner.visible === undefined &&
				inner.repeat === undefined &&
				innerDirection !== direction
				? ids[0]
				: undefined;
		};

		/** Where an element is drawn: the item of the repeated element around it, and whether a form holds it (its button sends the form). */
		interface Scope {
			readonly item: unknown;
			readonly inForm: boolean;
		}

		/** Draws an element, once for each item of its list when it repeats. `key` tells apart the copies of a repeated element. */
		const draw = (id: string, extra: readonly (string | undefined)[], scope: Scope, key: string): ReactNode => {
			const element = elementOf(id);
			if (element.repeat) {
				const items = resolve(element.repeat, scope.item, `${id}.repeat`);
				const list = Array.isArray(items) ? items : [];
				return list.length === 0
					? null
					: list.map((each, index) => drawOne(id, element, extra, { ...scope, item: each }, `${key}/${index}`));
			}
			return drawOne(id, element, extra, scope, key);
		};

		const drawOne = (
			id: string,
			element: SpecElement,
			extra: readonly (string | undefined)[],
			outer: Scope,
			key: string,
		): ReactNode => {
			const item = outer.item;
			const role = catalog.entries[element.type]?.role;
			const scope = role === "form" ? { ...outer, inForm: true } : outer;
			if (!shows(element.visible, item)) return null;
			const part = parts[element.type];
			if (!part) throw new ScreenSpecError(`${id}.type: there is no part "${element.type}"`);
			const children = element.children ?? [];
			const classes = [...extra];
			const childOf = (child: SpecChild, where: string): ReactNode => {
				if (typeof child === "string") return draw(child, [], scope, `${key}/${child}`);
				if (isSpacing(child)) return null;
				return resolve(child, item, where) as ReactNode;
			};
			let drawn: ReactNode[];
			if (catalog.entries[element.type]?.kind === "layout") {
				const direction = (element.props?.direction ?? "column") as Direction;
				const { container, margins } = spacingClasses(children, direction, pack.spacing);
				const merged = mergedChild(element);
				if (merged !== undefined) return draw(merged, [...classes, ...container], scope, key);
				classes.push(...container);
				// A margin is the space after the child before it, so the first child shown has none.
				let shown = false;
				drawn = children.map((child: SpecChild, index) => {
					if (typeof child !== "string") return null;
					const node = draw(child, [shown ? margins.get(index) : undefined], scope, `${key}/${child}`);
					if (node !== null) shown = true;
					return node;
				});
			} else {
				drawn = children.map((child, index) => childOf(child, `${id}.children[${index}]`));
			}
			const props: Record<string, unknown> = { key };
			if (referred.has(id)) props.id = domId(id);
			// The data a field holds: its name when the form sends it, and the value it starts with.
			if (element.bind !== undefined) {
				props.name = element.bind.split("/").pop();
				props.value = read(data, element.bind);
			}
			// A button in a form sends it; elsewhere a button does what is wired to it later.
			if (role === "button") props.type = scope.inForm ? "submit" : "button";
			for (const [name, value] of Object.entries(element.props ?? {})) {
				const resolved = resolve(value, item, `${id}.props.${name}`);
				const rule = catalog.entries[element.type]?.props[name];
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
			const className = join(...classes);
			if (className) props.className = className;
			return createElement(part as (props: object) => ReactNode, props, ...drawn);
		};

		const scope = { item: undefined, inForm: false };
		const overlays = (spec.overlays ?? []).map((id) => draw(id, [], scope, id));
		return overlays.length === 0
			? draw(spec.root, [], scope, spec.root)
			: createElement(Fragment, null, draw(spec.root, [], scope, spec.root), ...overlays);
	};
}
