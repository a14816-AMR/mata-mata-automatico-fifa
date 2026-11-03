import { Route, Routes } from 'react-router-dom'
import Background from './components/Background'
import PublicPage from './pages/PublicPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <>
      <Background />
      <Routes>
        <Route path="/" element={<PublicPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<PublicPage />} />
      </Routes>
    </>
  )
}
