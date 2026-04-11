import { useState, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { TrendingUp, Mail, Lock } from 'lucide-react'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useContext(AuthContext)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(email, password); navigate('/') }
    catch (err) { setError(err.response?.data?.error || 'Giriş yapılamadı.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <TrendingUp size={24} className="text-white" />
          </div>
          <div><div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">FinansRadar</div>
            <div className="text-xs text-slate-500 -mt-0.5">BORSA ANALİZ</div></div>
        </div>
        <div className="glass-card p-8" style={{ boxShadow: '0 0 40px rgba(139,92,246,0.1)' }}>
          <h2 className="text-xl font-bold text-center mb-1">Hoş Geldiniz</h2>
          <p className="text-sm text-slate-500 text-center mb-6">Hesabınıza giriş yapın</p>
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div><label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase tracking-wider">E-posta</label>
              <div className="relative"><Mail size={16} className="absolute left-3.5 top-3 text-slate-600" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ornek@email.com" className="input-field pl-10" /></div></div>
            <div><label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase tracking-wider">Şifre</label>
              <div className="relative"><Lock size={16} className="absolute left-3.5 top-3 text-slate-600" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="input-field pl-10" /></div></div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
              Giriş Yap
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-slate-500">Hesabınız yok mu? <Link to="/register" className="text-purple-400 hover:underline font-semibold">Kayıt Olun</Link></div>
        </div>
      </div>
    </div>
  )
}
export default Login
