import { createFileRoute } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { ProjectDashboard } from '@/components/dashboard/ProjectDashboard'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <>
      <ProjectDashboard />
      <Toaster position="bottom-right" />
    </>
  )
}
