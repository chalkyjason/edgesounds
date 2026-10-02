import { Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Landing } from './pages/Landing'
import { FFmpegProvider } from './hooks/useFFmpeg'
import { MySoundsProvider } from './hooks/useMySounds'
import { SharedAudioProvider } from './hooks/useSharedAudio'
import { ToastProvider } from './hooks/useToast'

// Every page but the landing one loads on first visit: the font tools, the
// converter and JSZip need not be parsed before the first screen draws.
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const OsdHome = lazy(() => import('./pages/osd/OsdHome').then((m) => ({ default: m.OsdHome })))
const FontDetail = lazy(() => import('./pages/osd/FontDetail').then((m) => ({ default: m.FontDetail })))
const FontEditor = lazy(() => import('./pages/osd/FontEditor').then((m) => ({ default: m.FontEditor })))
const SplashMaker = lazy(() => import('./pages/osd/SplashMaker').then((m) => ({ default: m.SplashMaker })))
const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })))
const Convert = lazy(() => import('./pages/Convert').then((m) => ({ default: m.Convert })))
const MySounds = lazy(() => import('./pages/MySounds').then((m) => ({ default: m.MySounds })))
const Setup = lazy(() => import('./pages/Setup').then((m) => ({ default: m.Setup })))

/** A page that crashed stays crashed only until you navigate away from it. */
function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SharedAudioProvider>
          <FFmpegProvider>
            <MySoundsProvider>
              <BrowserRouter>
                <Layout>
                  <RouteErrorBoundary>
                    <Suspense fallback={<p className="text-zinc-400">Loading…</p>}>
                      <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/sounds" element={<Home />} />
                        <Route path="/sounds/library" element={<Library />} />
                        <Route path="/sounds/convert" element={<Convert />} />
                        <Route path="/sounds/my" element={<MySounds />} />
                        <Route path="/sounds/setup" element={<Setup />} />
                        <Route path="/osd" element={<OsdHome />} />
                        <Route path="/osd/fonts/:variant" element={<FontDetail />} />
                        <Route path="/osd/fonts/:variant/edit" element={<FontEditor />} />
                        <Route path="/osd/splash" element={<SplashMaker />} />
                        <Route path="*" element={<Landing />} />
                      </Routes>
                    </Suspense>
                  </RouteErrorBoundary>
                </Layout>
              </BrowserRouter>
            </MySoundsProvider>
          </FFmpegProvider>
        </SharedAudioProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
