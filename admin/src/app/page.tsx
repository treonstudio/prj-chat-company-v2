'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/context/AuthContext'
import LoadingScreen from '@/components/LoadingScreen'

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

  return <LoadingScreen />
}
