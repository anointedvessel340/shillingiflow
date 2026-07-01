import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-provider";
import { useWorkspace } from "./workspace-provider";
import { parseQuickCapture, type Category } from "@/lib/quick-capture-parser";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export function QuickCapture({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { workspace, currency } = useWorkspace();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [chosenCategoryId, setChosenCategoryId] = useState<string | null>(null);
  const [type, setType] = useState<"income" | "expense">("expense");

  // Keyboard shortcut: N to open, Esc handled by Dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) { setText(""); setChosenCategoryId(null); setType("expense"); }
  }, [open]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, workspace")
        .eq("archived", false);
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const { data: learnings = new Map<string, string>() } = useQuery({
    queryKey: ["learnings", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_learnings")
        .select("term, category_id")
        .eq("workspace", workspace);
      if (error) throw error;
      const m = new Map<string, string>();
      for (const row of data ?? []) m.set(row.term, row.category_id);
      return m;
    },
  });

  const { data: defaultAccount } = useQuery({
    queryKey: ["default-account", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name")
        .eq("archived", false)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const parsed = useMemo(
    () => parseQuickCapture(text, categories, learnings, workspace),
    [text, categories, learnings, workspace],
  );

  useEffect(() => { setType(parsed.type); }, [parsed.type]);

  const activeCategoryId = chosenCategoryId ?? parsed.matchedCategory?.id ?? null;
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;
  const needsClarification = parsed.amount !== null && !!parsed.term && !parsed.matchedCategory && !chosenCategoryId;

  const workspaceCats = categories.filter((c) => c.workspace === workspace);

  const save = useMutation({
    mutationFn: async () => {
      if (!user || parsed.amount == null || !activeCategoryId || !defaultAccount) throw new Error("Missing fields");
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        amount: parsed.amount,
        type,
        category_id: activeCategoryId,
        account_id: defaultAccount.id,
        workspace,
        description: parsed.term || null,
      });
      if (error) throw error;
      // Save the learning so this term resolves instantly next time
      if (parsed.term) {
        await supabase.from("category_learnings").upsert({
          user_id: user.id,
          term: parsed.term,
          category_id: activeCategoryId,
          workspace,
        }, { onConflict: "user_id,term,workspace" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["learnings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Saved", {
        description: `${formatCurrency(parsed.amount ?? 0, { currency })} · ${activeCategory?.name}`,
      });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const canSave = parsed.amount != null && !!activeCategoryId && !!defaultAccount && !save.isPending;

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSave && !needsClarification) {
      e.preventDefault();
      save.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="card-surface top-[15%] translate-y-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Quick add transaction</DialogTitle>
        <DialogDescription className="sr-only">
          Type an amount and description. It will be categorized automatically.
        </DialogDescription>

        <div className="space-y-4">
          <Input
            autoFocus
            value={text}
            onChange={(e) => { setText(e.target.value); setChosenCategoryId(null); }}
            onKeyDown={onEnter}
            placeholder='e.g. "50 tomatoes"  or  "10000 wedding photography"'
            className="h-12 border-0 bg-transparent px-0 text-lg shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {/* Live preview chip */}
          {parsed.amount != null && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={cn(
                "inline-flex items-center gap-1 rounded-md border border-[color:var(--color-hairline)] px-2 py-1",
                type === "income" ? "text-[color:var(--color-positive)]" : "text-foreground",
              )}>
                {type === "income" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                <span className="num">{formatCurrency(parsed.amount, { currency })}</span>
              </span>
              {activeCategory ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--color-hairline)] px-2 py-1 text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]" />
                  {activeCategory.name}
                  {parsed.matchSource && !chosenCategoryId && (
                    <span className="ml-1 text-[10px] text-muted-foreground/70">· {parsed.matchSource}</span>
                  )}
                </span>
              ) : parsed.term ? (
                <span className="text-muted-foreground">Which category?</span>
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground">
                Enter to save · workspace: {workspace}
              </span>
            </div>
          )}

          {/* Type toggle */}
          {parsed.amount != null && (
            <div className="flex items-center gap-1 rounded-lg border border-[color:var(--color-hairline)] p-0.5 w-fit">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs capitalize",
                    type === t ? "bg-[color:var(--color-surface-2)]" : "text-muted-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Category picker — either clarification or manual override */}
          {parsed.amount != null && (needsClarification || !activeCategoryId) && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {needsClarification ? "We don't recognise this yet — pick a category and we'll remember it." : "Pick a category:"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {workspaceCats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setChosenCategoryId(c.id)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs transition-colors",
                      chosenCategoryId === c.id
                        ? "border-[color:var(--color-gold)] text-[color:var(--color-gold)]"
                        : "border-[color:var(--color-hairline)] text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              disabled={!canSave || needsClarification}
              onClick={() => save.mutate()}
              className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90"
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
