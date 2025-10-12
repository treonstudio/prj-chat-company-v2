"use client"

import { useState, useEffect } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/context/SidebarContext"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import createUser from "@/firebase/auth/createUser"
import { useAuthContext } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getUsers, getUsersCount } from "@/firebase/firestore/getUsers"
import updateUser from "@/firebase/firestore/updateUser"
import { DocumentSnapshot } from "firebase/firestore"

const topActiveUsers = [
  { name: "edoedo", avatar: "/avatars/1.jpg", time: "Just now" },
  { name: "susiaja", avatar: "/avatars/2.jpg", time: "Just now" },
  { name: "coba ganti", avatar: "/avatars/3.jpg", time: "21h ago" },
  { name: "ushiushi", avatar: null, time: "2d ago" },
  { name: "irfanirfan", avatar: null, time: "12d ago" },
]

interface User {
  id: string
  email: string
  displayName?: string
  createdAt: string
  isActive: boolean
}

export default function DashboardPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const { toggleSidebar } = useSidebar()
  const { user, loading } = useAuthContext()
  const router = useRouter()

  // Users list state
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [totalUsers, setTotalUsers] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [pageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)

  // Protect the page - redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin")
    }
  }, [user, loading, router])

  // Fetch users count
  useEffect(() => {
    const fetchUsersCount = async () => {
      const { count, error } = await getUsersCount()
      if (!error) {
        setTotalUsers(count)
        setTotalPages(Math.ceil(count / pageSize))
      }
    }

    if (user) {
      fetchUsersCount()
    }
  }, [user, pageSize])

  // Fetch users data
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true)
      console.log("Fetching users...")
      const { result, error, lastVisible } = await getUsers(pageSize)

      console.log("Users result:", result)
      console.log("Users error:", error)

      if (!error && result) {
        console.log("Setting users:", result.length, "users")
        setUsers(result as User[])
        setLastDoc(lastVisible || null)
      } else {
        console.error("Error fetching users:", error)
        toast.error("Gagal memuat data users")
      }

      setUsersLoading(false)
    }

    if (user) {
      fetchUsers()
    }
  }, [user, pageSize])

  // Load next page
  const loadNextPage = async () => {
    if (!lastDoc) return

    setUsersLoading(true)
    const { result, error, lastVisible } = await getUsers(pageSize, lastDoc)

    if (!error && result) {
      setUsers(result as User[])
      setLastDoc(lastVisible || null)
      setCurrentPage((prev) => prev + 1)
    } else {
      console.error("Error fetching users:", error)
      toast.error("Gagal memuat data users")
    }

    setUsersLoading(false)
  }

  // Load previous page
  const loadPreviousPage = async () => {
    if (currentPage === 1) return

    setUsersLoading(true)
    // Reset to first page for now (simplified pagination)
    const { result, error, lastVisible } = await getUsers(pageSize)

    if (!error && result) {
      setUsers(result as User[])
      setLastDoc(lastVisible || null)
      setCurrentPage(1)
    } else {
      console.error("Error fetching users:", error)
      toast.error("Gagal memuat data users")
    }

    setUsersLoading(false)
  }

  // Reload users after adding new user
  const reloadUsers = async () => {
    setUsersLoading(true)
    const { result, error, lastVisible } = await getUsers(pageSize)

    if (!error && result) {
      setUsers(result as User[])
      setLastDoc(lastVisible || null)
      setCurrentPage(1)

      // Update count
      const { count } = await getUsersCount()
      setTotalUsers(count)
      setTotalPages(Math.ceil(count / pageSize))
    }

    setUsersLoading(false)
  }

  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus

    try {
      const { error } = await updateUser(userId, { isActive: newStatus })

      if (error) {
        console.error("Error updating user status:", error)
        toast.error("Gagal mengubah status user")
      } else {
        // Update local state
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === userId ? { ...u, isActive: newStatus } : u
          )
        )
        toast.success(`User berhasil di${newStatus ? "aktifkan" : "nonaktifkan"}`)
      }
    } catch (err) {
      console.error("Error updating user status:", err)
      toast.error("Terjadi kesalahan saat mengubah status user")
    }
  }

  const handleAddUser = async () => {
    // Clear previous messages and errors
    setMessage(null)
    setEmailError("")
    setPasswordError("")

    console.log("=== Starting Add User ===")
    console.log("Email:", username)
    console.log("Password length:", password.length)

    let hasError = false

    // Validation
    if (!username.trim()) {
      setEmailError("Email tidak boleh kosong")
      hasError = true
    } else {
      // Email validation (basic)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(username)) {
        setEmailError("Format email tidak valid. Contoh: user@example.com")
        hasError = true
      }
    }

    if (!password) {
      setPasswordError("Password tidak boleh kosong")
      hasError = true
    } else if (password.length < 6) {
      setPasswordError("Password harus minimal 6 karakter")
      hasError = true
    }

    if (hasError) {
      return
    }

    setIsLoading(true)

    try {
      console.log("Creating user with Firebase...")
      const { result, error } = await createUser(username, password, {
        displayName: username.split("@")[0],
      })

      if (error) {
        // Handle specific Firebase errors
        const firebaseError = error as any
        console.error("Firebase error:", firebaseError)

        if (firebaseError.code === "auth/email-already-in-use") {
          setEmailError("Email sudah terdaftar")
          toast.error("Gagal menambahkan user", {
            description: "Email sudah terdaftar"
          })
        } else if (firebaseError.code === "auth/invalid-email") {
          setEmailError("Format email tidak valid")
          toast.error("Gagal menambahkan user", {
            description: "Format email tidak valid"
          })
        } else if (firebaseError.code === "auth/weak-password") {
          setPasswordError("Password terlalu lemah (minimal 6 karakter)")
          toast.error("Gagal menambahkan user", {
            description: "Password terlalu lemah (minimal 6 karakter)"
          })
        } else {
          const errorMsg = firebaseError.message || "Gagal menambahkan user"
          setMessage({
            type: "error",
            text: `Error: ${errorMsg}`
          })
          toast.error("Gagal menambahkan user", {
            description: errorMsg
          })
        }
      } else {
        console.log("User created successfully:", result)
        setMessage({ type: "success", text: "User berhasil ditambahkan!" })

        // Show success toast
        toast.success("User berhasil ditambahkan!", {
          description: `Email: ${username}`
        })

        // Clear form
        setUsername("")
        setPassword("")

        // Reload users list
        reloadUsers()

        // Auto-clear success message after 3 seconds
        setTimeout(() => {
          setMessage(null)
        }, 3000)
      }
    } catch (err) {
      console.error("Error adding user:", err)
      const errorMessage = "Terjadi kesalahan saat menambahkan user"
      setMessage({ type: "error", text: errorMessage })
      toast.error("Error", {
        description: errorMessage
      })
    } finally {
      setIsLoading(false)
    }
  }

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
              <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500">Admin / Dashboard</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Add User Form */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8">
              <h2 className="mb-6 text-xl font-semibold text-gray-900">
                Tambah User Baru
              </h2>
              {message && (
                <div
                  className={`mb-4 rounded-lg p-4 ${
                    message.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {message.text}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="email"
                    placeholder="contoh: user@example.com"
                    type="email"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      setEmailError("")
                    }}
                    className={`h-12 ${emailError ? "border-red-500 focus:border-red-500" : "border-gray-200"}`}
                    disabled={isLoading}
                  />
                  {emailError ? (
                    <p className="mt-1 text-xs text-red-600">{emailError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      Masukkan email yang valid (harus mengandung @)
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setPasswordError("")
                    }}
                    className={`h-12 ${passwordError ? "border-red-500 focus:border-red-500" : "border-gray-200"}`}
                    disabled={isLoading}
                  />
                  {passwordError ? (
                    <p className="mt-1 text-xs text-red-600">{passwordError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      Password harus minimal 6 karakter
                    </p>
                  )}
                </div>
                <div className="flex justify-center pt-2">
                  <Button
                    onClick={handleAddUser}
                    disabled={isLoading}
                    className="bg-emerald-500 px-8 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Menambahkan..." : "Tambah User"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats and Top Users */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Stats Cards */}
            <div className="space-y-6">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total User</p>
                      <p className="mt-2 text-3xl font-semibold text-emerald-600">{totalUsers}</p>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-500">
                      <svg
                        className="h-8 w-8 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Calls</p>
                      <p className="mt-2 text-3xl font-semibold text-emerald-600">65</p>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-500">
                      <svg
                        className="h-8 w-8 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Active Users */}
            <Card className="border-0 shadow-sm lg:col-span-2">
              <CardContent className="p-6">
                <h3 className="mb-6 text-lg font-semibold text-gray-900">
                  Top Active Users
                </h3>
                <div className="flex gap-8">
                  {topActiveUsers.map((user, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback className="bg-gray-200">
                          {user.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500">{user.time}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Join Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Join</h3>
                <div className="text-sm text-gray-500">
                  Total: {totalUsers} users
                </div>
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
                </div>
              ) : users.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  Belum ada user terdaftar
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold text-gray-900">NAME</TableHead>
                        <TableHead className="font-semibold text-gray-900">
                          JOINING DATE
                        </TableHead>
                        <TableHead className="font-semibold text-gray-900">
                          ACTIVE/DEACTIVE
                        </TableHead>
                        <TableHead className="font-semibold text-gray-900">ACTION</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => {
                        // Handle createdAt - could be Timestamp or string
                        let dateStr = 'N/A';
                        try {
                          if (user.createdAt) {
                            // If it's a Firestore Timestamp, it will have toDate() method
                            const date = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
                            dateStr = date.toLocaleDateString('id-ID');
                          }
                        } catch (e) {
                          console.error('Error parsing date:', e);
                        }

                        return (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.displayName || user.email}
                            </TableCell>
                            <TableCell>
                              {dateStr}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={user.isActive}
                                onCheckedChange={() => handleStatusToggle(user.id, user.isActive)}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                              >
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Pagination Controls */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages || 1}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadPreviousPage}
                        disabled={currentPage === 1 || usersLoading}
                        className="disabled:opacity-50"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadNextPage}
                        disabled={!lastDoc || currentPage >= totalPages || usersLoading}
                        className="disabled:opacity-50"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
