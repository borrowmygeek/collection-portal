'use client'

import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardHeader from '@/components/DashboardHeader'
import Sidebar from '@/components/Sidebar'

interface DashboardClientProps {
  children: React.ReactNode
}

export default function DashboardClient({ children }: DashboardClientProps) {
  const { profile, signOut } = useAuth()

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader />
          
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
} 