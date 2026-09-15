import { AdminShell } from "@/components/admin/admin-shell";
import { AdminAnalyticsClient } from "@/components/admin/admin-analytics-client";

export const metadata = {
  title: "Analytics | Admin",
};

export default function AdminAnalyticsPage() {
  return (
    <AdminShell
      title="Analytics"
      subtitle="Pulse, funnel drop-off, and volume for the customer apply journey."
      active="analytics"
    >
      <AdminAnalyticsClient />
    </AdminShell>
  );
}
