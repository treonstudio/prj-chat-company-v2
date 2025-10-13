"use client"

import { useState, useEffect } from "react"
import { Trash2, Eye, EyeOff, Users, Phone, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Header } from "@/components/header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import createUser from "@/firebase/auth/createUser"
import { useAuthContext } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getUsers, getUsersCount } from "@/firebase/firestore/getUsers"
import updateUser from "@/firebase/firestore/updateUser"
import deleteUser from "@/firebase/firestore/deleteUser"
import updateUserPassword from "@/firebase/firestore/updateUserPassword"
import { DocumentSnapshot } from "firebase/firestore"
import getCalls from "@/firebase/firestore/getCalls"
import getUserData from "@/firebase/firestore/getUserData"

interface User {
  id: string
  email: string
  username?: string
  displayName?: string
  createdAt: string
  isActive: boolean
  role: string
}

export default function DashboardPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [usernameError, setUsernameError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
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

  // Calls state
  const [totalCalls, setTotalCalls] = useState(0)
  const [totalCallDuration, setTotalCallDuration] = useState(0)
  const [callsLoading, setCallsLoading] = useState(true)

  // Change password state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [newPasswordError, setNewPasswordError] = useState("")

  // Protect the page - redirect if not authenticated or not admin
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!loading && !user) {
        router.push("/signin")
        return
      }

      if (user) {
        // Check if user has admin role
        const { result: userData, error } = await getUserData(user.uid)

        if (error || !userData) {
          console.error("Error fetching user data:", error)
          toast.error("Terjadi kesalahan saat memuat data user")
          router.push("/signin")
          return
        }

        // Type assertion for userData with role field
        const userWithRole = userData as { id: string; role?: string }

        if (userWithRole.role !== "admin") {
          toast.error("Akses ditolak", {
            description: "Hanya admin yang dapat mengakses dashboard"
          })
          router.push("/signin")
        }
      }
    }

    checkAdminAccess()
  }, [user, loading, router])

  // Fetch users count
  useEffect(() => {
    const fetchUsersCount = async () => {
      // Exclude current user from count
      const { count, error } = await getUsersCount(user?.uid)
      if (!error) {
        setTotalUsers(count)
        setTotalPages(Math.ceil(count / pageSize))
      }
    }

    if (user) {
      fetchUsersCount()
    }
  }, [user, pageSize])

  // Fetch calls data
  useEffect(() => {
    const fetchCalls = async () => {
      setCallsLoading(true)
      const { result, error } = await getCalls()

      if (!error && result) {
        setTotalCalls(result.totalCalls)
        setTotalCallDuration(result.totalDuration)
      } else {
        console.error("Error fetching calls:", error)
        toast.error("Gagal memuat data calls")
      }

      setCallsLoading(false)
    }

    if (user) {
      fetchCalls()
    }
  }, [user])

  // Fetch users data
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true)
      // Exclude current user from list
      const { result, error, lastVisible } = await getUsers(pageSize, undefined, user?.uid)

      if (!error && result) {
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
    // Exclude current user from list
    const { result, error, lastVisible } = await getUsers(pageSize, lastDoc, user?.uid)

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
    // Exclude current user from list
    const { result, error, lastVisible } = await getUsers(pageSize, undefined, user?.uid)

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
    // Exclude current user from list
    const { result, error, lastVisible } = await getUsers(pageSize, undefined, user?.uid)

    if (!error && result) {
      setUsers(result as User[])
      setLastDoc(lastVisible || null)
      setCurrentPage(1)

      // Update count (exclude current user)
      const { count } = await getUsersCount(user?.uid)
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

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await deleteUser(userId)

      if (error) {
        console.error("Error deleting user:", error)
        toast.error("Gagal menghapus user")
      } else {
        // Update local state - remove deleted user
        setUsers((prevUsers) => prevUsers.filter((u) => u.id !== userId))

        // Update count
        setTotalUsers((prev) => prev - 1)
        setTotalPages(Math.ceil((totalUsers - 1) / pageSize))

        toast.success("User berhasil dihapus")
      }
    } catch (err) {
      console.error("Error deleting user:", err)
      toast.error("Terjadi kesalahan saat menghapus user")
    }
  }

  const handleOpenPasswordDialog = (userId: string) => {
    setSelectedUserId(userId)
    setNewPassword("")
    setNewPasswordError("")
    setShowNewPassword(false)
    setPasswordDialogOpen(true)
  }

  const handleChangePassword = async () => {
    if (!selectedUserId) return

    // Validation
    setNewPasswordError("")

    if (!newPassword) {
      setNewPasswordError("Password tidak boleh kosong")
      return
    }

    if (newPassword.length < 6) {
      setNewPasswordError("Password harus minimal 6 karakter")
      return
    }

    setIsLoading(true)

    try {
      const { error } = await updateUserPassword(selectedUserId, newPassword)

      if (error) {
        console.error("Error updating password:", error)
        toast.error("Gagal mengubah password")
      } else {
        toast.success("Password berhasil diubah")
        setPasswordDialogOpen(false)
        setNewPassword("")
        setSelectedUserId(null)
      }
    } catch (err) {
      console.error("Error updating password:", err)
      toast.error("Terjadi kesalahan saat mengubah password")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddUser = async () => {
    // Clear previous messages and errors
    setMessage(null)
    setUsernameError("")
    setPasswordError("")

    let hasError = false

    // Validation
    if (!username.trim()) {
      setUsernameError("Username tidak boleh kosong")
      hasError = true
    } else if (username.length < 3) {
      setUsernameError("Username harus minimal 3 karakter")
      hasError = true
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameError("Username hanya boleh mengandung huruf, angka, dan underscore")
      hasError = true
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
      const { result, error } = await createUser(username, password, {
        displayName: username,
        role: "user", // Always set role to "user" by default
      })

      if (error) {
        // Handle specific Firebase errors
        const firebaseError = error as any
        console.error("Firebase error:", firebaseError)

        if (firebaseError.code === "auth/email-already-in-use") {
          setUsernameError("Username sudah terdaftar")
          toast.error("Gagal menambahkan user", {
            description: "Username sudah terdaftar"
          })
        } else if (firebaseError.code === "auth/invalid-email") {
          setUsernameError("Format username tidak valid")
          toast.error("Gagal menambahkan user", {
            description: "Format username tidak valid"
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
        setMessage({ type: "success", text: "User berhasil ditambahkan!" })

        // Show success toast
        toast.success("User berhasil ditambahkan!", {
          description: `Username: ${username}`
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-7xl p-8 space-y-8">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6">
              <div className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
              <div className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
            <div className="lg:col-span-2 h-40 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
          <div className="h-96 bg-gray-200 rounded-lg animate-pulse"></div>
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
      <Header title="Dashboard" breadcrumb="Admin / Dashboard" />

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
                  <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-700">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="username"
                    placeholder="contoh: johndoe"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      setUsernameError("")
                    }}
                    className={`h-12 ${usernameError ? "border-red-500 focus:border-red-500" : "border-gray-200"}`}
                    disabled={isLoading}
                  />
                  {usernameError ? (
                    <p className="mt-1 text-xs text-red-600">{usernameError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      Username harus minimal 3 karakter (huruf, angka, underscore)
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimal 6 karakter"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setPasswordError("")
                      }}
                      className={`h-12 pr-10 ${passwordError ? "border-red-500 focus:border-red-500" : "border-gray-200"}`}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
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
                    className="bg-emerald-400 px-8 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Menambahkan..." : "Tambah User"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total User</p>
                    <p className="mt-2 text-3xl font-semibold text-emerald-400">{totalUsers}</p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-50">
                    <Users className="h-8 w-8 text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Calls</p>
                    {callsLoading ? (
                      <div className="mt-2 h-8 w-16 animate-pulse bg-gray-200 rounded"></div>
                    ) : (
                      <p className="mt-2 text-3xl font-semibold text-emerald-400">{totalCalls}</p>
                    )}
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-50">
                    <Phone className="h-8 w-8 text-emerald-400" />
                  </div>
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
                <div className="space-y-4">
                  <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                  <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                  <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
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
                            const createdAt = user.createdAt as any;
                            const date = createdAt.toDate ? createdAt.toDate() : new Date(user.createdAt);
                            dateStr = date.toLocaleDateString('id-ID');
                          }
                        } catch (e) {
                          console.error('Error parsing date:', e);
                        }

                        return (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.username || user.displayName || user.email}
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
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenPasswordDialog(user.id)}
                                  className="border-blue-300 text-blue-400 hover:bg-blue-50"
                                >
                                  <Key className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-red-300 text-red-400 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Hapus User</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Apakah Anda yakin ingin menghapus user &quot;{user.displayName || user.email}&quot;?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                                        Batal
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="bg-red-400 text-white hover:bg-red-500"
                                      >
                                        Hapus
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
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

      {/* Change Password Dialog */}
      <AlertDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ubah Password User</AlertDialogTitle>
            <AlertDialogDescription>
              Masukkan password baru untuk user ini
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-gray-700">
              Password Baru <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                placeholder="Minimal 6 karakter"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setNewPasswordError("")
                }}
                className={`h-12 pr-10 ${newPasswordError ? "border-red-500 focus:border-red-500" : "border-gray-200"}`}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                disabled={isLoading}
              >
                {showNewPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {newPasswordError && (
              <p className="mt-1 text-xs text-red-600">{newPasswordError}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-gray-100 text-gray-700 hover:bg-gray-200"
              disabled={isLoading}
            >
              Batal
            </AlertDialogCancel>
            <Button
              onClick={handleChangePassword}
              disabled={isLoading}
              className="bg-blue-400 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isLoading ? "Mengubah..." : "Ubah Password"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
