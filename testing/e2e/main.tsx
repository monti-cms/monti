import { httpTransport, MontiAdmin } from "@monti-cms/admin";
import { createRoot } from "react-dom/client";
import "../../packages/ui/.storybook/storybook.css";
import "../setup";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");

// The admin as a site mounts it, over HTTP (T13 will make this the example app): the root class the design system's tokens hang on, and the API.
createRoot(root).render(
	<div className="monti-admin min-h-screen bg-monti-page text-monti-default">
		<MontiAdmin transport={httpTransport("/admin/api")} apiBase="/admin/api" siteName="Monti e2e" />
	</div>,
);
