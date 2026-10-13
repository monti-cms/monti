import { type BlockDefinition, SiteProvider } from "@monti-cms/core/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { NodeViewProps } from "@tiptap/react";
import { testSite } from "../../../core/test/site";
import { BlockEditorProvider, type BlockView } from "../editor/blocks/use-block-editor";

/** The views look media up through the query cache; no retries so a failed lookup shows at once. */
const testQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

/**
 * Renders a block view without a Tiptap node view renderer: the view gets its `useBlockEditor` context from the node view props a test builds
 * by hand (a fake node, a fake `updateAttributes`). For tests of one view; a test of how views and the document work together mounts a real editor.
 */
export const withBlockEditor = (View: BlockView, definition: BlockDefinition) => (props: NodeViewProps) => (
	<SiteProvider site={testSite}>
		<QueryClientProvider client={testQueryClient}>
			<BlockEditorProvider nodeView={props} definition={definition}>
				<View />
			</BlockEditorProvider>
		</QueryClientProvider>
	</SiteProvider>
);
