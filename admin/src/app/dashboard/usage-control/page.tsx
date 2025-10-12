"use client"

import { useState, useEffect } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/context/SidebarContext"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useAuthContext } from "@/context/AuthContext"
import { useRouter } from "next/navigation"

export default function UsageControlPage() {
  const { toggleSidebar } = useSidebar()
  const { user, loading } = useAuthContext()
  const router = useRouter()
  const [callsAllowed, setCallsAllowed] = useState(true)
  const [textMessageAllowed, setTextMessageAllowed] = useState(true)
  const [mediaSendAllowed, setMediaSendAllowed] = useState(true)
  const [maxFileSize, setMaxFileSize] = useState("60")

  // Protect the page - redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin")
    }
  }, [user, loading, router])

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="text-gray-600 hover:text-gray-900"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Usage Control</h1>
              <p className="text-sm text-gray-500">Admin / Usage Control</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Usage Option Card */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8">
              <div className="mb-6 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                <h2 className="text-xl font-semibold text-emerald-600">Usage Option</h2>
              </div>

              <div className="space-y-8">
                {/* Calls Allowed */}
                <div className="flex items-center justify-between">
                  <span className="text-base text-gray-900">Calls Allowed</span>
                  <Switch
                    checked={callsAllowed}
                    onCheckedChange={setCallsAllowed}
                  />
                </div>

                {/* Text Message Allowed */}
                <div className="flex items-center justify-between">
                  <span className="text-base text-gray-900">Text Message Allowed</span>
                  <Switch
                    checked={textMessageAllowed}
                    onCheckedChange={setTextMessageAllowed}
                  />
                </div>

                {/* Media Send Allowed */}
                <div className="flex items-center justify-between">
                  <span className="text-base text-gray-900">Media Send Allowed</span>
                  <Switch
                    checked={mediaSendAllowed}
                    onCheckedChange={setMediaSendAllowed}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Control Card */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8">
              <div className="mb-6 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                <h2 className="text-xl font-semibold text-emerald-600">Usage Control</h2>
              </div>

              <div className="space-y-4">
                <label className="text-base font-medium text-gray-900">
                  Max File Size
                </label>
                <Input
                  type="number"
                  value={maxFileSize}
                  onChange={(e) => setMaxFileSize(e.target.value)}
                  className="h-12 border-gray-200 bg-gray-50"
                />
              </div>
            </CardContent>
          </Card>

          {/* Update Button */}
          <div className="flex justify-end">
            <Button className="bg-emerald-500 px-12 py-6 text-base text-white hover:bg-emerald-600">
              Update
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
