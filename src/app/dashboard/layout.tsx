import { Sidebar } from "@/components/dashboard/sidebar";
import { Toaster } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-dark">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "!bg-midnight-plum !border-slate-DEFAULT/20 !text-mist",
        }}
      />
    </div>
  );
}
