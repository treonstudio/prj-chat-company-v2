"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { SidebarProvider } from "@/context/SidebarContext"
import { useAuthContext } from "@/context/AuthContext"

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

function ProtectedDashboard({ children }: { children: React.ReactNode }) {
  const { user }: any = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    // Check for default admin in localStorage
    const adminAuth = localStorage.getItem('adminAuth')

    if (!user && !adminAuth) {
      router.push("/signin")
    }
  }, [user, router])

  // Check if either Firebase user or localStorage admin exists
  const adminAuth = typeof window !== 'undefined' ? localStorage.getItem('adminAuth') : null

  if (user === null && !adminAuth) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg font-medium text-gray-900">Loading...</div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedDashboard>
      <SidebarProvider>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </SidebarProvider>
    </ProtectedDashboard>
  )
}
