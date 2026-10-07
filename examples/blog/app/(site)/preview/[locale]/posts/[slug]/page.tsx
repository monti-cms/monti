import { BlogPostPreviewPage, generateBlogPostPreviewMetadata } from "@/components/monti/blog-theme/blog-post";

// The preview reads the draft of the signed-in admin, so it is never cached. The address is `site.previewPath` (`/preview`) plus the post's public path
// (`/ko/posts/<slug>`). Under `next dev` you are that admin, so the editor's Preview button works with no login.
export const dynamic = "force-dynamic";

export const generateMetadata = generateBlogPostPreviewMetadata;

export default BlogPostPreviewPage;
