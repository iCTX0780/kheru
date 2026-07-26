import { createFileRoute } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { SettingsPage } from '@/components/settings/SettingsPage'

export const Route = createFileRoute('/settings')({
  component: SettingsRoute,
})

function SettingsRoute() {
  return (
    <>
      <SettingsPage />
      <Toaster position="bottom-right" />
    </>
  )
}
