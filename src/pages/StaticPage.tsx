import { useParams, Link } from "react-router-dom";
import { useStaticPage } from "@/hooks/useStaticPages";
import { ArrowLeft, Loader2 } from "lucide-react";
import DOMPurify from "dompurify";

const StaticPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading } = useStaticPage(slug);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <h1 className="text-2xl font-display font-bold mb-2">Page not found</h1>
        <Link to="/" className="text-primary text-sm hover:underline">Back home</Link>
      </div>
    );
  }

  const safeHtml = DOMPurify.sanitize(page.content, { USE_PROFILES: { html: true } });

  return (
    <div className="min-h-screen bg-background pt-20 pb-24 md:pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={16} /> Back
        </Link>
        <article
          className="prose prose-invert max-w-none prose-headings:font-display prose-h1:text-3xl prose-h1:mb-4 prose-p:text-muted-foreground prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </div>
    </div>
  );
};

export default StaticPage;
