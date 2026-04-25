import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { useContext } from 'react'
import { AuthContext } from '../../context/AuthContext'

const Layout = () => {
  const { user } = useContext(AuthContext)

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100 relative">
      <Navbar />
      <main className="pt-20 lg:pt-24 min-h-screen">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default Layout
