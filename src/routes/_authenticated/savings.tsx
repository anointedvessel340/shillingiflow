import { createFileRoute } from "@tanstack/react-router";
import { SavingsScreen } from "@/components/savings-screen";

export const Route = createFileRoute("/_authenticated/savings")({
  head: () => ({ meta: [{ title: "Savings — SHILLINGITRACK" }, { name: "description", content: "Named savings accounts with clean interest math." }] }),
  component: () => <SavingsScreen kind="savings" />,
});
