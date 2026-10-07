import { BlogPostPreviewPage, generateBlogPostPreviewMetadata } from "@/components/monti/blog-theme/blog-post";

// The preview reads the draft of the signed-in admin, so it is never cached: `BlogPostPage` waits for the request (`connection()`) inside a `Suspense`
// boundary, which also keeps it valid under Next's `cacheComponents`. The address is `site.previewPath` (`/preview`) plus the post's public path
// (`/ko/posts/<slug>`). Under `next dev` you are that admin, so the editor's Preview button works with no login.
export const generateMetadata = generateBlogPostPreviewMetadata;

export default BlogPostPreviewPage;
