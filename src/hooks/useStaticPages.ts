import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StaticPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  show_in_footer: boolean;
  sort_order: number;
  updated_at: string;
}

export const useFooterPages = () => {
  return useQuery({
    queryKey: ["static-pages", "footer"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("static_pages")
        .select("slug,title,sort_order,show_in_footer,is_published")
        .eq("is_published", true)
        .eq("show_in_footer", true)
        .order("sort_order", { ascending: true });
      return (data as StaticPage[]) || [];
    },
    staleTime: 5 * 60_000,
  });
};

export const useStaticPage = (slug: string | undefined) => {
  return useQuery({
    queryKey: ["static-page", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data } = await (supabase as any)
        .from("static_pages")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      return (data as StaticPage) || null;
    },
    enabled: !!slug,
  });
};

export const useAllStaticPages = () => {
  return useQuery({
    queryKey: ["static-pages", "all"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("static_pages")
        .select("*")
        .order("sort_order", { ascending: true });
      return (data as StaticPage[]) || [];
    },
  });
};

export const useUpsertStaticPage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (page: Partial<StaticPage> & { slug: string; title: string }) => {
      const { error } = await (supabase as any)
        .from("static_pages")
        .upsert(page, { onConflict: "slug" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["static-pages"] });
      qc.invalidateQueries({ queryKey: ["static-page"] });
    },
  });
};

export const useDeleteStaticPage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("static_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["static-pages"] }),
  });
};
