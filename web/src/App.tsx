import type { ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Home } from './pages/Home'
import { Landing } from './pages/Landing'
import { OsdHome } from './pages/osd/OsdHome'
import { FontDetail } from './pages/osd/FontDetail'
import { FontEditor } from './pages/osd/FontEditor'
import { SplashMaker } from './pages/osd/SplashMaker'
import { Library } from './pages/Library'
import { Convert } from './pages/Convert'
import { MySounds } from './pages/MySounds'
import { Setup } from './pages/Setup'
import { FFmpegProvider } from './hooks/useFFmpeg'
import { MySoundsProvider } from './hooks/useMySounds'
import { SharedAudioProvider } from './hooks/useSharedAudio'
import { ToastProvider } from './hooks/useToast'

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
