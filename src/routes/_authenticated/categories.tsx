import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Archive, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — SHILLINGITRACK" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; count: number } | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");

  const { data: cats = [] } = useQuery({
    queryKey: ["categories-full", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").eq("workspace", workspace).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categories").insert({ user_id: user!.id, name: name.trim(), workspace });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Category added"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("categories").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").update({ archived: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Archived"); },
  });

  const startDelete = async (id: string, catName: string) => {
    const { count } = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("category_id", id).is("deleted_at", null);
    setDeleteTarget({ id, name: catName, count: count ?? 0 });
    setReassignTo("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.count > 0) {
      if (reassignTo === "uncat") {
        await supabase.from("transactions").update({ category_id: null }).eq("category_id", deleteTarget.id);
      } else if (reassignTo) {
        await supabase.from("transactions").update({ category_id: reassignTo }).eq("category_id", deleteTarget.id);
      } else { toast.error("Choose an option first"); return; }
    }
    const { error } = await supabase.from("categories").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    setDeleteTarget(null);
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    toast.success("Deleted");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <h1 className="font-display text-xl font-semibold">Categories · <span className="text-muted-foreground capitalize">{workspace}</span></h1>

      <div className="card-surface flex items-center gap-2 p-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a category…" onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate()} />
        <Button onClick={() => name.trim() && create.mutate()} disabled={!name.trim() || create.isPending}
          className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">
          <Plus className="mr-1 h-4 w-4" />Add
        </Button>
      </div>

      <div className="card-surface divide-y divide-[color:var(--color-hairline)]">
        {cats.filter((c) => !c.archived).map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <span className="h-2 w-2 rounded-full" style={{ background: c.color ?? "#8B8D97" }} />
            <input
              defaultValue={c.name}
              onBlur={(e) => e.target.value !== c.name && rename.mutate({ id: c.id, name: e.target.value })}
              className="flex-1 bg-transparent text-sm outline-none focus:text-foreground"
            />
            <button onClick={() => archive.mutate(c.id)} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Archive"><Archive className="h-3.5 w-3.5" /></button>
            <button onClick={() => startDelete(c.id, c.name)} className="rounded p-1 text-muted-foreground hover:text-[color:var(--color-negative)]" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {cats.filter((c) => !c.archived).length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No categories yet.</p>}
      </div>

      {cats.some((c) => c.archived) && (
        <div className="card-surface p-4">
          <h3 className="mb-2 text-sm font-medium">Archived</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {cats.filter((c) => c.archived).map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span>{c.name}</span>
                <button onClick={async () => { await supabase.from("categories").update({ archived: false }).eq("id", c.id); qc.invalidateQueries({ queryKey: ["categories"] }); }}
                  className="text-xs text-[color:var(--color-gold)]">Restore</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="card-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.count ? `${deleteTarget.count} transaction(s) are attached. Choose what to do with them.` : "This category has no transactions."}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && deleteTarget.count > 0 && (
            <div className="space-y-2 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="reassign" value="uncat" checked={reassignTo === "uncat"} onChange={() => setReassignTo("uncat")} />
                Leave uncategorised
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="reassign" value="pick" checked={reassignTo !== "uncat" && reassignTo !== ""} onChange={() => setReassignTo("pick")} />
                Reassign to:
                <select value={reassignTo === "uncat" ? "" : reassignTo} onChange={(e) => setReassignTo(e.target.value)}
                  className="rounded-md border border-[color:var(--color-hairline)] bg-transparent px-2 py-1">
                  <option value="">Select…</option>
                  {cats.filter((c) => c.id !== deleteTarget.id && !c.archived).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button onClick={confirmDelete} className="bg-[color:var(--color-negative)]">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
