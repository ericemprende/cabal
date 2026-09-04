'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { AdminPanel } from '@/components/cabal/admin-panel'
import { useUI } from '@/lib/store'

/**
 * Modal del dashboard admin dentro de la app principal.
 * Todo el contenido vive en AdminPanel (también usado por la página /admin).
 */
export function AdminDialog() {
  const { adminOpen, setAdminOpen } = useUI()
  return (
    <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto border-white/12 bg-[#121410] p-0 sm:max-w-3xl"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Dashboard Admin</DialogTitle>
        <AdminPanel enabled={adminOpen} />
      </DialogContent>
    </Dialog>
  )
}
