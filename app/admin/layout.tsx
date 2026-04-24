import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <div className="fixed top-4 right-4 z-50 flex justify-end">
        <ThemeToggle />
      </div>
      {children}
    </ThemeProvider>
  );
}
