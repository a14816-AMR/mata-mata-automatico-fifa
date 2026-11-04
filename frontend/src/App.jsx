import { Route, Routes } from 'react-router-dom'
import Background from './components/Background'
import PublicPage from './pages/PublicPage'
import AdminPage from './pages/AdminPage'
import DemoPage from './pages/DemoPage'

export default function App() {
  return (
    <>
      <Background />
      <Routes>
        <Route path="/" element={<PublicPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/demo-gol" element={<DemoPage />} />
        <Route path="*" element={<PublicPage />} />
      </Routes>
    </>
  )
}
