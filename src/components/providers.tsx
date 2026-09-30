"use client"

import { useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { listenForAppAuth } from "@/lib/native-bridge"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )
  // Dentro de la app de iOS: recoge la vuelta del login social (en la web no hace nada)
  useEffect(() => listenForAppAuth(), [])
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
