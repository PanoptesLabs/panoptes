import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { AuthProvider } from "@/components/dashboard/auth-provider";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <TooltipProvider>
        <div className="flex min-h-screen bg-slate-dark">
          <Sidebar />
          <main id="main-content" className="flex-1 overflow-x-hidden pt-14 lg:pt-0">
            <Topbar />
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </main>
          <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!bg-midnight-plum !border-slate-DEFAULT/20 !text-mist",
          }}
          />
        </div>
      </TooltipProvider>
    </AuthProvider>
  );
}
