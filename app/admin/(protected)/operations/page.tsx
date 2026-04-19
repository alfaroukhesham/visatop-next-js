import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin operations | Unified Hybrid Portal",
};

export default function AdminOperationsPage() {
  redirect("/admin/applications");
}
