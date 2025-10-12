"use client"

import { useState } from "react"
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

const topActiveUsers = [
  { name: "edoedo", avatar: "/avatars/1.jpg", time: "Just now" },
  { name: "susiaja", avatar: "/avatars/2.jpg", time: "Just now" },
  { name: "coba ganti", avatar: "/avatars/3.jpg", time: "21h ago" },
  { name: "ushiushi", avatar: null, time: "2d ago" },
  { name: "irfanirfan", avatar: null, time: "12d ago" },
]

const recentJoinData = [
  { id: 1, name: "Alice Johnson", joinDate: "2024-10-10", isActive: true },
  { id: 2, name: "Bob Smith", joinDate: "2024-10-09", isActive: true },
  { id: 3, name: "Carol Williams", joinDate: "2024-10-08", isActive: false },
  { id: 4, name: "David Brown", joinDate: "2024-10-07", isActive: true },
  { id: 5, name: "Emma Davis", joinDate: "2024-10-06", isActive: true },
]

export default function DashboardPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const { toggleSidebar } = useSidebar()
  const [userStatuses, setUserStatuses] = useState<{ [key: number]: boolean }>({
    1: true,
    2: true,
    3: false,
    4: true,
    5: true,
  })

  const handleStatusToggle = (userId: number) => {
    setUserStatuses((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }))
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
              <div className="space-y-4">
                <Input
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 border-gray-200"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-gray-200"
                />
                <div className="flex justify-center pt-2">
                  <Button className="bg-emerald-500 px-8 text-white hover:bg-emerald-600">
                    Tambah User
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
                      <p className="mt-2 text-3xl font-semibold text-emerald-600">18</p>
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
                <button className="text-sm text-gray-500 hover:text-gray-700">
                  Top Active Users
                </button>
              </div>
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
                  {recentJoinData.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.joinDate}</TableCell>
                      <TableCell>
                        <Switch
                          checked={userStatuses[user.id]}
                          onCheckedChange={() => handleStatusToggle(user.id)}
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
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
