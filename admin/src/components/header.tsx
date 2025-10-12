"use client"

import { Menu } from "lucide-react"
import { useSidebar } from "@/context/SidebarContext"

interface HeaderProps {
  title: string
  breadcrumb: string
}

export function Header({ title, breadcrumb }: HeaderProps) {
  const { toggleSidebar } = useSidebar()

  return (
    <header className="border-b bg-white px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500">{breadcrumb}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
