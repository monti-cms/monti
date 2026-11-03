import {
	evaluateVisibility,
	type PropResolutionContext,
	resolveElementProps,
	resolvePropValue,
	type Spec,
	splitRepeatVisibility,
} from "@json-render/core";
import type { Components } from "@json-render/react";
import { Fragment, type ReactNode } from "react";
import { Box } from "../box";
import { Button } from "../button";
import { FormField, FormFieldError, FormFieldLabel } from "../field";
import { Image } from "../image";
import { Input } from "../input";
import { Separator } from "../separator";
import { Stack } from "../stack";
import { Heading, Text } from "../text";
import { TextButton } from "../text-button";
import { checkDrawnProps, type screenCatalog } from "./catalog";

/** Each catalog entry drawn by its real part. A spec's props are already checked against the catalog, so they pass through as they are. */
const parts: Components<typeof screenCatalog> = {
	Stack: ({ props, children }) => <Stack {...props}>{children}</Stack>,
	Box: ({ props, children }) => <Box {...props}>{children}</Box>,
	Heading: ({ props: { text, ...props } }) => <Heading {...props}>{text}</Heading>,
	Text: ({ props: { text, ...props } }) => <Text {...props}>{text}</Text>,
	Form: ({ props, children }) => (
		<form method={props.method} action={props.action}>
			{children}
		</form>
	),
	FormField: ({ children }) => <FormField>{children}</FormField>,
	FormFieldLabel: ({ props }) => <FormFieldLabel htmlFor={props.htmlFor}>{props.text}</FormFieldLabel>,
	Input: ({ props: { invalid, ...props } }) => (
		<Input
			{...props}
			aria-invalid={invalid ? true : undefined}
			aria-describedby={invalid ? `${props.id}-error` : undefined}
		/>
	),
	FormFieldError: ({ props }) => <FormFieldError id={props.id}>{props.text}</FormFieldError>,
	Button: ({ props: { text, icon, ...props } }) => (
		<Button {...props}>
			{icon ? <Image src={icon} alt="" size="icon" radius="none" /> : null}
			{text}
		</Button>
	),
	Separator: ({ props }) => <Separator label={props.label} />,
	TextButton: ({ props }) => <TextButton type={props.type}>{props.text}</TextButton>,
};

type Draw = (context: { props: Record<string, unknown>; children?: ReactNode }) => ReactNode;

/**
 * Draws one element and its children. The expressions (`$state`, `$item`, `$cond`, `visible`, `repeat`) are json-render's, resolved by its own
 * core functions; the drawing is plain React with no context or hooks, so a screen spec draws in a server component as well as in a client one.
 */
function draw(spec: Spec, id: string, context: PropResolutionContext, key: string): ReactNode {
	const element = spec.elements[id];
	if (!element) return null;
	const childrenOf = (scope: PropResolutionContext, prefix: string) =>
		(element.children ?? []).map((child) => draw(spec, child, scope, `${prefix}/${child}`));
	let children: ReactNode[];
	if (element.repeat) {
		const { container, itemFilter } = splitRepeatVisibility(element.visible);
		if (!evaluateVisibility(container, context)) return null;
		const path = element.repeat.statePath;
		const items = resolvePropValue({ $state: path }, context);
		children = (Array.isArray(items) ? items : []).flatMap((item, index) => {
			const scope = { ...context, repeatItem: item, repeatIndex: index, repeatBasePath: `${path}/${index}` };
			return itemFilter && !evaluateVisibility(itemFilter, scope) ? [] : childrenOf(scope, `${key}/${index}`);
		});
	} else {
		if (!evaluateVisibility(element.visible, context)) return null;
		children = childrenOf(context, key);
	}
	const props = resolveElementProps(element.props ?? {}, context);
	if (process.env.NODE_ENV !== "production") {
		// A value read from the state that the part does not take leaves the design system as surely as one written in the spec.
		for (const problem of checkDrawnProps(element.type, props)) console.error(`screen spec ${id}: ${problem}`);
	}
	const part = (parts as unknown as Record<string, Draw>)[element.type];
	if (!part) return null;
	return <Fragment key={key}>{part({ props, children: children.length > 0 ? children : undefined })}</Fragment>;
}

/**
 * Draws a screen spec with the design system's parts. `state` is what the screen shows (its texts, the addresses its forms post to, which
 * state it is in); the spec reads it with `$state`, `$item` and `visible`, and holds no copy or address of its own.
 */
export function ScreenSpec({ spec, state }: { spec: Spec; state: Record<string, unknown> }) {
	return draw(spec, spec.root, { stateModel: state }, spec.root);
}

export type { Spec as ScreenSpecDocument };
