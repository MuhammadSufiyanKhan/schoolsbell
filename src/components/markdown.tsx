"use client";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders an AI answer as a readable document (headings, lists, tables), not as raw text.
 * The text is UNTRUSTED model output, so: raw HTML is not rendered (react-markdown's default), images are dropped
 * (no tracking pixels / data leaks), unsafe link schemes such as javascript: are stripped by react-markdown, and
 * links open in a new tab with noopener.
 */
const components: Components = {
  h1: (p) => <h1 className="mb-3 mt-8 border-b border-border pb-2 text-xl font-semibold tracking-tight first:mt-0" {...strip(p)} />,
  h2: (p) => <h2 className="mb-2 mt-7 text-lg font-semibold tracking-tight first:mt-0" {...strip(p)} />,
  h3: (p) => <h3 className="mb-1.5 mt-5 text-base font-semibold first:mt-0" {...strip(p)} />,
  h4: (p) => <h4 className="mb-1 mt-4 text-sm font-semibold uppercase tracking-wide text-muted first:mt-0" {...strip(p)} />,
  p: (p) => <p className="my-3 leading-7" {...strip(p)} />,
  ul: (p) => <ul className="my-3 list-disc space-y-1.5 pl-6 marker:text-muted" {...strip(p)} />,
  ol: (p) => <ol className="my-3 list-decimal space-y-1.5 pl-6 marker:text-muted" {...strip(p)} />,
  li: (p) => <li className="leading-7 [&>ol]:my-1 [&>p]:my-1 [&>ul]:my-1" {...strip(p)} />,
  strong: (p) => <strong className="font-semibold" {...strip(p)} />,
  em: (p) => <em className="italic" {...strip(p)} />,
  blockquote: (p) => <blockquote className="my-4 border-l-4 border-brand/40 pl-4 text-muted" {...strip(p)} />,
  hr: () => <hr className="my-6 border-border" />,
  // A link whose address was stripped as unsafe (e.g. javascript:) must not become a clickable empty link.
  a: ({ href, children }) =>
    href && /^(https?:|mailto:)/i.test(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline underline-offset-2 hover:opacity-80">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  img: () => null,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[420px] border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: (p) => <thead className="bg-brand-soft" {...strip(p)} />,
  th: (p) => <th className="border-b border-border px-3 py-2 text-left font-semibold" {...strip(p)} />,
  td: (p) => <td className="border-t border-border px-3 py-2 align-top leading-6" {...strip(p)} />,
  // Rare in teaching material; keep it plain and readable rather than console-styled.
  code: (p) => <code className="rounded bg-brand-soft px-1.5 py-0.5 text-[0.92em]" {...strip(p)} />,
  pre: (p) => <pre className="my-3 whitespace-pre-wrap rounded-lg bg-background p-3 text-sm leading-6" {...strip(p)} />,
};

// react-markdown passes an internal `node` prop; never spread it onto a DOM element.
function strip<T extends object>(props: T) {
  const { node: _node, ...rest } = props as T & { node?: unknown };
  void _node;
  return rest;
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[15px] text-foreground">
      {/* skipHtml: raw HTML from the model is dropped, not shown as clutter. Models often use <br> inside table
          cells, so keep those as real line breaks first. */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {children.replace(/<br\s*\/?>/gi, "  \n")}
      </ReactMarkdown>
    </div>
  );
}
