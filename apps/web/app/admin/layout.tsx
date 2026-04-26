import type { ReactNode } from "react";
import AdminSessionBar from "@/components/admin/AdminSessionBar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-6xl px-4 pt-2 md:px-6">
        <AdminSessionBar />
      </div>
      {children}
    </div>
  );
}
