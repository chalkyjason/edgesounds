import type { ReactNode } from 'react'
import { Nav } from './Nav'
import { Footer } from './Footer'
import { Toaster } from './Toaster'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-200">
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <Footer />
      <Toaster />
    </div>
  )
}
