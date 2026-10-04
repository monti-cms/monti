"use client";

import { type FieldViewProps, useCmsAdminComponents } from "../../admin-components";

/**
 * Screen of a view field (`fields.view({ view })`). The admin extension registers views through `fieldViews`.
 * If the name is not registered, nothing is rendered.
 */
export function FieldView({ view, ...props }: FieldViewProps & { view: string }) {
	const { fieldViews } = useCmsAdminComponents();
	const View = fieldViews?.[view];
	return View ? <View {...props} /> : null;
}
