'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/context/AuthContext'

export default function Home() {
  const { user }: any = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    // Check for default admin in localStorage
    const adminAuth = localStorage.getItem('adminAuth')

    if (user || adminAuth) {
      router.push('/dashboard')
    } else {
      router.push('/signin')
    }
  }, [user, router])

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4 text-lg font-medium text-gray-900">Loading...</div>
      </div>
    </div>
  )
}
