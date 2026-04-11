import { useState, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { TrendingUp, Mail, Lock, User } from 'lucide-react'

const Register = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useContext(AuthContext)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await register(name, email, password); navigate('/') }
    catch (err) { setError(err.response?.data?.error || 'Kayıt olunamadı.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <TrendingUp size={24} className="text-white" />
          </div>
          <div><div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">FinansRadar</div>
            <div className="text-xs text-slate-500 -mt-0.5">BORSA ANALİZ</div></div>
        </div>
        <div className="glass-card p-8" style={{ boxShadow: '0 0 40px rgba(139,92,246,0.1)' }}>
          <h2 className="text-xl font-bold text-center mb-1">Hesap Oluştur</h2>
          <p className="text-sm text-slate-500 text-center mb-6">Ücretsiz kaydolun</p>
          {error && <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-lg mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase tracking-wider">Ad Soyad</label>
              <div className="relative"><User size={16} className="absolute left-3.5 top-3 text-slate-600" />
                <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Adınız" className="input-field pl-10" /></div></div>
            <div><label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase tracking-wider">E-posta</label>
              <div className="relative"><Mail size={16} className="absolute left-3.5 top-3 text-slate-600" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ornek@email.com" className="input-field pl-10" /></div></div>
            <div><label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase tracking-wider">Şifre</label>
              <div className="relative"><Lock size={16} className="absolute left-3.5 top-3 text-slate-600" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="input-field pl-10" minLength={6} /></div></div>
            <button type="submit" disabled={loading} className="btn-primary w-full">Kayıt Ol</button>
          </form>
          <div className="mt-6 text-center text-sm text-slate-500">Hesabınız var mı? <Link to="/login" className="text-purple-400 hover:underline font-semibold">Giriş Yap</Link></div>
        </div>
      </div>
    </div>
  )
}
export default Register
