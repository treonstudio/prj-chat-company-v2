"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, BarChart3, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/context/SidebarContext"
import { getAuth, signOut } from "firebase/auth"
import firebase_app from "@/firebase/config"
import Image from "next/image"

const auth = getAuth(firebase_app)

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    title: "Usage Control",
    icon: BarChart3,
    href: "/dashboard/usage-control",
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isCollapsed, toggleSidebar } = useSidebar()

  const handleLogout = async () => {
    try {
      // Sign out from Firebase
      await signOut(auth)

      router.push("/signin")
    } catch (error) {
      console.error("Error signing out:", error)
      // Even if Firebase logout fails, still redirect
      router.push("/signin")
    }
  }

  return (
    <>
      {/* Sidebar */}
      <div
        className={cn(
          "relative flex h-screen flex-col bg-[#1a1f2e] text-white transition-all duration-300",
          isCollapsed ? "w-[70px]" : "w-[200px]"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-2 px-6 py-6",
          isCollapsed && "justify-center px-3"
        )}>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
            <Image
              src="/logo.png"
              alt="Chatku Logo"
              width={40}
              height={40}
              className="h-10 w-10"
              priority
            />
          </div>
          {!isCollapsed && (
            <span className="text-xl font-semibold whitespace-nowrap">Chatku</span>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-emerald-500 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap">{item.title}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-800 px-3 py-4">
          <button
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white",
              isCollapsed && "justify-center"
            )}
            title={isCollapsed ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">Logout</span>}
          </button>
        </div>
      </div>
    </>
  )
}
