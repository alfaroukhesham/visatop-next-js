import { AdminAuthStoreSync } from "@/components/admin/admin-auth-store-sync";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AdminAuthStoreSync />
      <div className="fixed top-4 right-4 z-50 flex justify-end">
        <ThemeToggle />
      </div>
      {children}
    </ThemeProvider>
  );
}
