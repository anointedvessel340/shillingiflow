import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "SHILLINGITRACK — Your financial workspace" },
    { name: "description", content: "Your personal and business financial records in one private workspace." },
    { property: "og:title", content: "SHILLINGITRACK — Your financial workspace" },
    { property: "og:description", content: "Your personal and business financial records in one private workspace." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
