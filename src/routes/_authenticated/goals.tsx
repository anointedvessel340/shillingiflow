import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Pause, Play, Copy, Archive, Plus } from "lucide-react";
import { ErrorState, SkeletonList } from "@/components/ui/loading";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals — SHILLINGITRACK" }] }),
  component: GoalsPage,
});

function GoalsPage() {
  const { user } = useAuth();
  const { workspace, currency } = useWorkspace();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", target: "", deadline: "" });
  const [contributingTo, setContributingTo] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState("");

  const { data: goals = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["goals", user?.id, workspace],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").eq("workspace", workspace).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contribs = [] } = useQuery({
    queryKey: ["contribs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("goal_contributions").select("goal_id, amount, date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("goals").insert({
        user_id: user!.id, name: form.name, target_amount: Number(form.target),
        deadline: form.deadline || null, workspace,
      });
      if (error) throw error;
    },
    onSuccess: () => { setCreating(false); setForm({ name: "", target: "", deadline: "" }); qc.invalidateQueries({ queryKey: ["goals"] }); toast.success("Goal created"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const contribute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("goal_contributions").insert({
        user_id: user!.id, goal_id: contributingTo!, amount: Number(contribAmount),
      });
      if (error) throw error;
    },
    onSuccess: () => { setContributingTo(null); setContribAmount(""); qc.invalidateQueries({ queryKey: ["goals"] }); qc.invalidateQueries({ queryKey: ["contribs"] }); toast.success("Contribution added"); },
    onError: (e) => {
      console.error(e);
      toast.error("Couldn't add this contribution. Please try again.");
    },
  });

  const toggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    const { error } = await supabase.from("goals").update({ status: newStatus }).eq("id", id);
    if (error) { console.error(error); toast.error("Couldn't update this goal. Please try again."); return; }
    qc.invalidateQueries({ queryKey: ["goals"] });
    toast.success(newStatus === "active" ? "Goal resumed" : "Goal paused");
  };
  const archive = async (id: string) => {
    const { error } = await supabase.from("goals").update({ status: "archived" }).eq("id", id);
    if (error) { console.error(error); toast.error("Couldn't archive this goal. Please try again."); return; }
    qc.invalidateQueries({ queryKey: ["goals"] });
    toast.success("Goal archived");
  };
  const duplicate = async (g: typeof goals[0]) => {
    const { error } = await supabase.from("goals").insert({ user_id: user!.id, name: g.name + " (copy)", target_amount: g.target_amount, deadline: g.deadline, workspace, status: "active" });
    if (error) { console.error(error); toast.error("Couldn't duplicate this goal. Please try again."); return; }
    qc.invalidateQueries({ queryKey: ["goals"] });
    toast.success("Goal duplicated");
  };

  const forecast = (goalId: string, target: number, current: number) => {
    const gc = contribs.filter((c) => c.goal_id === goalId);
    if (gc.length < 2) return null;
    const dates = gc.map((c) => new Date(c.date).getTime()).sort();
    const spanDays = (dates[dates.length - 1] - dates[0]) / 86400000 || 1;
    const totalContrib = gc.reduce((s, c) => s + Number(c.amount), 0);
    const perDay = totalContrib / spanDays;
    if (perDay <= 0) return null;
    const remaining = target - current;
    if (remaining <= 0) return null;
    const daysLeft = Math.ceil(remaining / perDay);
    const eta = new Date(Date.now() + daysLeft * 86400000);
    return eta;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Goals · <span className="text-muted-foreground capitalize">{workspace}</span></h1>
        <Button onClick={() => setCreating(true)} className="bg-[color:var(--color-gold)] text-[color:var(--color-gold-foreground)] hover:bg-[color:var(--color-gold)]/90">
          <Plus className="mr-1 h-4 w-4" />New goal
        </Button>
      </div>

      {isError ? (
        <div className="card-surface p-4"><ErrorState message="Couldn't load goals." onRetry={() => refetch()} /></div>
      ) : isLoading ? (
        <div className="card-surface p-4"><SkeletonList rows={5} /></div>
      ) : goals.length === 0 ? <p className="card-surface p-6 text-center text-sm text-muted-foreground">No goals yet.</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.min(1, Number(g.current_amount) / Number(g.target_amount));
            const eta = forecast(g.id, Number(g.target_amount), Number(g.current_amount));
            return (
              <div key={g.id} className={`card-surface flex gap-4 p-5 ${g.status !== "active" ? "opacity-60" : ""}`}>
                <ProgressRing progress={pct} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="truncate text-sm font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{Math.round(pct * 100)}% · {g.status}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => toggle(g.id, g.status)} title={g.status === "active" ? "Pause" : "Resume"} className="rounded p-1 text-muted-foreground hover:text-foreground">
                        {g.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </button>
                      <button onClick={() => duplicate(g)} title="Duplicate" className="rounded p-1 text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
                      <button onClick={() => archive(g.id)} title="Archive" className="rounded p-1 text-muted-foreground hover:text-foreground"><Archive className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <p className="num mt-2 text-lg">{formatCurrency(Number(g.current_amount), { currency })}</p>
                  <p className="text-xs text-muted-foreground">of {formatCurrency(Number(g.target_amount), { currency })}{g.deadline && ` · by ${formatDate(g.deadline)}`}</p>
                  {eta && <p className="mt-1 text-xs text-[color:var(--color-gold)]">On track: {formatDate(eta)}</p>}
                  <Button size="sm" variant="outline" onClick={() => setContributingTo(g.id)} className="mt-3 h-7 text-xs">Contribute</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="card-surface sm:max-w-md">
          <DialogHeader><DialogTitle>New goal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs text-muted-foreground">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Target amount</label><Input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Deadline (optional)</label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!form.name || !form.target}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contributingTo} onOpenChange={(v) => !v && setContributingTo(null)}>
        <DialogContent className="card-surface sm:max-w-sm">
          <DialogHeader><DialogTitle>Add contribution</DialogTitle></DialogHeader>
          <Input type="number" placeholder="Amount" value={contribAmount} onChange={(e) => setContribAmount(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContributingTo(null)}>Cancel</Button>
            <Button onClick={() => contribute.mutate()} disabled={!contribAmount}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProgressRing({ progress }: { progress: number }) {
  const size = 72, stroke = 6, r = (size - stroke) / 2, c = 2 * Math.PI * r, dash = c * progress;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-gold)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`} transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}
