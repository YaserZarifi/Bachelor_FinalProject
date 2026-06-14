import { AnimatePresence, motion } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './pages/Home.jsx'
import { LoginPage } from './pages/Login.jsx'
import { RegisterPage } from './pages/Register.jsx'
import { MyReports } from './pages/MyReports.jsx'
import { Navbar } from './components/Navbar.jsx'
import { Footer } from './components/Footer.jsx'
import { AuroraBackground } from './components/ui/AuroraBackground.jsx'
import { ReportModalProvider } from './components/report/ReportModal.jsx'

function Page({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <ReportModalProvider>
      <div className="relative flex min-h-screen flex-col">
        <AuroraBackground />
        <Navbar />
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Page><HomePage /></Page>} />
              <Route path="/login" element={<Page><LoginPage /></Page>} />
              <Route path="/register" element={<Page><RegisterPage /></Page>} />
              <Route path="/reports" element={<Page><MyReports /></Page>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </main>
        <Footer />
      </div>
    </ReportModalProvider>
  )
}
