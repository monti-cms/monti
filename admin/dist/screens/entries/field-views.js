"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useCmsAdminComponents } from "../../admin-components.js";
/**
 * Screen of a view field (`fields.view({ view })`). The admin extension registers views through `fieldViews`.
 * If the name is not registered, nothing is rendered.
 */
export function FieldView({ view, ...props }) {
    const { fieldViews } = useCmsAdminComponents();
    const View = fieldViews?.[view];
    return View ? _jsx(View, { ...props }) : null;
}
