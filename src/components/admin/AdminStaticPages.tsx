import { useState, useEffect, useRef } from "react";
import { useAllStaticPages, useUpsertStaticPage, useDeleteStaticPage, type StaticPage } from "@/hooks/useStaticPages";
import { FileText, Plus, Trash2, Save, Loader2, ExternalLink, Bold, Italic, Underline, Heading1, Heading2, List, ListOrdered, Link as LinkIcon, Quote } from "lucide-react";
import { toast } from "sonner";

// Lightweight contentEditable rich-text editor (replaces react-quill which is incompatible with React 18)
const RichEditor = ({ value, onChange }: { value: string; onChange: (html: string) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);

  useEffect(() => {
    if (ref.current && value !== lastValue.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
      lastValue.current = value;
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    if (ref.current) {
      const html = ref.current.innerHTML;
      lastValue.current = html;
      onChange(html);
    }
  };

  const handleInput = () => {
    if (ref.current) {
      const html = ref.current.innerHTML;
      lastValue.current = html;
      onChange(html);
    }
  };

  const Btn = ({ onClick, children, title }: any) => (
    <button type="button" onClick={onClick} title={title} className="p-1.5 rounded hover:bg-gray-200 text-gray-700">
      {children}
    </button>
  );

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="flex flex-wrap gap-0.5 p-1.5 border-b border-gray-200 bg-gray-50">
        <Btn title="H1" onClick={() => exec("formatBlock", "<h1>")}><Heading1 size={14} /></Btn>
        <Btn title="H2" onClick={() => exec("formatBlock", "<h2>")}><Heading2 size={14} /></Btn>
        <Btn title="Bold" onClick={() => exec("bold")}><Bold size={14} /></Btn>
        <Btn title="Italic" onClick={() => exec("italic")}><Italic size={14} /></Btn>
        <Btn title="Underline" onClick={() => exec("underline")}><Underline size={14} /></Btn>
        <Btn title="Bullets" onClick={() => exec("insertUnorderedList")}><List size={14} /></Btn>
        <Btn title="Numbered" onClick={() => exec("insertOrderedList")}><ListOrdered size={14} /></Btn>
        <Btn title="Quote" onClick={() => exec("formatBlock", "<blockquote>")}><Quote size={14} /></Btn>
        <Btn title="Link" onClick={() => { const u = prompt("URL"); if (u) exec("createLink", u); }}><LinkIcon size={14} /></Btn>
        <Btn title="Clear" onClick={() => exec("removeFormat")}>✕</Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        className="p-3 min-h-[280px] bg-white text-gray-900 prose prose-sm max-w-none focus:outline-none"
        suppressContentEditableWarning
      />
    </div>
  );
};

const blank = (): Partial<StaticPage> => ({
  slug: "",
  title: "",
  content: "",
  is_published: true,
  show_in_footer: true,
  sort_order: 99,
});

const AdminStaticPages = () => {
  const { data: pages = [], isLoading } = useAllStaticPages();
  const upsert = useUpsertStaticPage();
  const remove = useDeleteStaticPage();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<StaticPage>>(blank());
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (selectedSlug) {
      const page = pages.find(p => p.slug === selectedSlug);
      if (page) { setForm(page); setIsNew(false); }
    }
  }, [selectedSlug, pages]);

  const handleNew = () => {
    setSelectedSlug(null);
    setForm(blank());
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!form.slug || !form.title) {
      toast.error("Slug and title are required");
      return;
    }
    try {
      await upsert.mutateAsync({
        slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        title: form.title,
        content: form.content || "",
        is_published: form.is_published ?? true,
        show_in_footer: form.show_in_footer ?? true,
        sort_order: form.sort_order ?? 99,
      });
      toast.success("Page saved");
      setIsNew(false);
      setSelectedSlug(form.slug!);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this page?")) return;
    await remove.mutateAsync(id);
    toast.success("Page deleted");
    setSelectedSlug(null);
    setForm(blank());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2"><FileText size={20} /> Legal & Static Pages</h2>
        <button onClick={handleNew} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm">
          <Plus size={14} /> New Page
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        <aside className="glass rounded-xl p-2 border border-border/30 space-y-1 max-h-[480px] overflow-y-auto">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-2">Loading…</p>
          ) : pages.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">No pages yet</p>
          ) : (
            pages.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedSlug(p.slug)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedSlug === p.slug ? "bg-primary/15 text-primary" : "hover:bg-secondary/50"
                }`}
              >
                <p className="font-medium truncate">{p.title}</p>
                <p className="text-[10px] text-muted-foreground">/{p.slug} • {p.is_published ? "live" : "draft"}</p>
              </button>
            ))
          )}
        </aside>

        {(selectedSlug || isNew) ? (
          <div className="glass rounded-xl p-4 border border-border/30 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Title</label>
                <input
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-secondary/50 border border-border/30 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Slug (URL)</label>
                <input
                  value={form.slug || ""}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  disabled={!isNew}
                  placeholder="privacy"
                  className="w-full bg-secondary/50 border border-border/30 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50 disabled:opacity-60"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="accent-primary" />
                Published
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.show_in_footer} onChange={(e) => setForm({ ...form, show_in_footer: e.target.checked })} className="accent-primary" />
                Show in footer
              </label>
              <label className="flex items-center gap-2">
                Order:
                <input type="number" value={form.sort_order ?? 99} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="w-16 bg-secondary/50 border border-border/30 rounded-lg px-2 py-1 text-sm" />
              </label>
              {!isNew && form.slug && (
                <a href={`/p/${form.slug}`} target="_blank" rel="noreferrer" className="ml-auto text-xs text-primary inline-flex items-center gap-1 hover:underline">
                  View <ExternalLink size={12} />
                </a>
              )}
            </div>

            <RichEditor
              value={form.content || ""}
              onChange={(content) => setForm({ ...form, content })}
            />

            <div className="flex justify-between pt-2">
              {!isNew && form.id && (
                <button onClick={() => handleDelete(form.id!)} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={upsert.isPending}
                className="ml-auto flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
              >
                {upsert.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Page
              </button>
            </div>
          </div>
        ) : (
          <div className="glass rounded-xl p-8 border border-border/30 text-center text-sm text-muted-foreground">
            Select a page on the left or create a new one.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminStaticPages;
