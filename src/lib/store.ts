'use client'

import { create } from 'zustand'
import type { AuthMode } from '@/components/cabal/auth-dialog'

export type TabKey = 'radar' | 'tokens' | 'feed' | 'leaderboard'

interface UIState {
  tab: TabKey
  setTab: (t: TabKey) => void
  launchDetailId: string | null
  openLaunch: (id: string | null) => void
  tokenDetailId: string | null
  openToken: (id: string | null) => void
  profileOpen: boolean
  setProfileOpen: (v: boolean) => void
  adminOpen: boolean
  setAdminOpen: (v: boolean) => void
  affiliatesOpen: boolean
  setAffiliatesOpen: (v: boolean) => void
  searchOpen: boolean
  setSearchOpen: (v: boolean) => void
  composerOpen: boolean
  setComposerOpen: (v: boolean) => void
  authOpen: boolean
  setAuthOpen: (v: boolean) => void
  authMode: AuthMode
  setAuthMode: (m: AuthMode) => void
  openAuth: (mode?: AuthMode) => void
}

export const useUI = create<UIState>((set) => ({
  tab: 'radar',
  setTab: (tab) => set({ tab }),
  launchDetailId: null,
  openLaunch: (launchDetailId) => set({ launchDetailId }),
  tokenDetailId: null,
  openToken: (tokenDetailId) => set({ tokenDetailId }),
  profileOpen: false,
  setProfileOpen: (profileOpen) => set({ profileOpen }),
  adminOpen: false,
  setAdminOpen: (adminOpen) => set({ adminOpen }),
  affiliatesOpen: false,
  setAffiliatesOpen: (affiliatesOpen) => set({ affiliatesOpen }),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  composerOpen: false,
  setComposerOpen: (composerOpen) => set({ composerOpen }),
  authOpen: false,
  setAuthOpen: (authOpen) => set({ authOpen }),
  authMode: 'login',
  setAuthMode: (authMode) => set({ authMode }),
  openAuth: (mode) => set({ authOpen: true, ...(mode ? { authMode: mode } : {}) }),
}))
