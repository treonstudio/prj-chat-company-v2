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
import getUsageControls from "@/firebase/firestore/getUsageControls"
import updateUsageControls from "@/firebase/firestore/updateUsageControls"
import getMaxFileSize from "@/firebase/firestore/getMaxFileSize"
import updateMaxFileSize from "@/firebase/firestore/updateMaxFileSize"
import { toast } from "sonner"

export default function UsageControlPage() {
  const { toggleSidebar } = useSidebar()
  const { user, loading } = useAuthContext()
  const router = useRouter()
  const [callsAllowed, setCallsAllowed] = useState(true)
  const [textMessageAllowed, setTextMessageAllowed] = useState(true)
  const [mediaSendAllowed, setMediaSendAllowed] = useState(true)
  const [maxFileSize, setMaxFileSize] = useState("60")
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Protect the page - redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin")
    }
  }, [user, loading, router])

  // Fetch usage controls from Firebase on component mount
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      setIsLoadingData(true)

      // Fetch usage controls from features collection
      const { result: usageResult, error: usageError } = await getUsageControls()

      // Fetch max file size from usageControls collection
      const { result: maxFileSizeResult, error: maxFileSizeError } = await getMaxFileSize()

      if (usageError) {
        console.error("Error fetching usage controls:", usageError)
        toast.error("Error loading usage controls data")
      } else if (usageResult) {
        setCallsAllowed(usageResult.allowCall ?? true)
        setTextMessageAllowed(usageResult.allowChat ?? true)
        setMediaSendAllowed(usageResult.allowCreateGroup ?? true)
      }

      if (maxFileSizeError) {
        console.error("Error fetching max file size:", maxFileSizeError)
        toast.error("Error loading max file size data")
      } else if (maxFileSizeResult !== null) {
        setMaxFileSize(maxFileSizeResult.toString())
      }

      setIsLoadingData(false)
    }

    fetchData()
  }, [user])

  // Handle update button click
  const handleUpdate = async () => {
    setIsSaving(true)

    try {
      // Update usage controls in features collection
      const { error: usageError } = await updateUsageControls({
        allowCall: callsAllowed,
        allowChat: textMessageAllowed,
        allowCreateGroup: mediaSendAllowed,
      })

      // Update max file size in usageControls collection
      const { error: maxFileSizeError } = await updateMaxFileSize(
        parseInt(maxFileSize) || 64
      )

      if (usageError || maxFileSizeError) {
        console.error("Error updating:", usageError || maxFileSizeError)
        toast.error("Failed to save changes. Please try again.")
      } else {
        toast.success("Changes saved successfully!")
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  // Show loading state while checking auth
  if (loading || isLoadingData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="border-b bg-white px-8 py-4">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="p-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-48 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-16 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
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
            <Button
              onClick={handleUpdate}
              disabled={isSaving}
              className="bg-emerald-400 px-12 py-6 text-base text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Update"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
