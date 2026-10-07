import { BlogPostPreviewPage, generateBlogPostPreviewMetadata } from "@/registry/monti/blog-theme/blog-post";

// The preview reads the draft of the signed-in admin, so it is never cached. The address is `site.previewPath` (here `/preview`) plus the post's public path.
export const dynamic = "force-dynamic";

export const generateMetadata = generateBlogPostPreviewMetadata;

export default BlogPostPreviewPage;
