import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Home } from './pages/Home'
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
                      <Route path="/" element={<Home />} />
                      <Route path="/library" element={<Library />} />
                      <Route path="/convert" element={<Convert />} />
                      <Route path="/my" element={<MySounds />} />
                      <Route path="/setup" element={<Setup />} />
                      <Route path="*" element={<Home />} />
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
