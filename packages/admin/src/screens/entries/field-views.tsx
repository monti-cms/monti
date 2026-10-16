"use client";

import { type FieldViewProps, useAdminComponents } from "../../admin-components";

/**
 * Screen of a view field (`fields.view({ view })`). The admin extension registers views through `fieldViews`.
 * If the name is not registered, nothing is rendered.
 */
export function FieldView({ view, ...props }: FieldViewProps & { view: string }) {
	const { fieldViews } = useAdminComponents();
	const View = fieldViews?.[view];
	return View ? <View {...props} /> : null;
}
