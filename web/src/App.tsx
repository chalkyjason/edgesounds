import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Home } from './pages/Home'
import { Landing } from './pages/Landing'
import { OsdHome } from './pages/osd/OsdHome'
import { FontDetail } from './pages/osd/FontDetail'
import { Library } from './pages/Library'
import { Convert } from './pages/Convert'
import { MySounds } from './pages/MySounds'
import { Setup } from './pages/Setup'
import { FFmpegProvider } from './hooks/useFFmpeg'
import { MySoundsProvider } from './hooks/useMySounds'
import { SharedAudioProvider } from './hooks/useSharedAudio'
import { ToastProvider } from './hooks/useToast'

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SharedAudioProvider>
          <FFmpegProvider>
            <MySoundsProvider>
              <BrowserRouter>
                <Layout>
                  <ErrorBoundary>
                    <Routes>
                      <Route path="/" element={<Landing />} />
                      <Route path="/sounds" element={<Home />} />
                      <Route path="/sounds/library" element={<Library />} />
                      <Route path="/sounds/convert" element={<Convert />} />
                      <Route path="/sounds/my" element={<MySounds />} />
                      <Route path="/sounds/setup" element={<Setup />} />
                      <Route path="/osd" element={<OsdHome />} />
                      <Route path="/osd/fonts/:variant" element={<FontDetail />} />
                      <Route path="*" element={<Landing />} />
                    </Routes>
                  </ErrorBoundary>
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
