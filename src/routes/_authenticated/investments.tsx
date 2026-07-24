import { createFileRoute } from "@tanstack/react-router";
import { SavingsScreen } from "@/components/savings-screen";

export const Route = createFileRoute("/_authenticated/investments")({
  head: () => ({ meta: [{ title: "Investments — SHILLINGITRACK" }, { name: "description", content: "Track holdings and valuations outside your cash accounts." }] }),
  component: () => <SavingsScreen kind="investment" />,
});
