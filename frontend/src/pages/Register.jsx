import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Activity, Mail, Lock, User } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Kayıt olunamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-purple flex items-center justify-center">
            <Activity size={24} className="text-bg-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">FinansRadar</h1>
        </div>

        <div className="glass-card neon-glow p-8">
          <h2 className="text-xl font-bold text-center mb-2">Hesap Oluştur</h2>
          <p className="text-sm text-text-muted text-center mb-6">Ücretsiz kaydolun ve hemen başlayın</p>

          {error && <div className="bg-red/10 border border-red/20 text-red text-sm p-3 rounded-lg mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">Ad Soyad</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-3 text-text-muted" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Adınız Soyadınız" className="input-field pl-10" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">E-posta</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3 text-text-muted" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ornek@email.com" className="input-field pl-10" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block uppercase tracking-wider">Şifre</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3 text-text-muted" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="input-field pl-10" minLength={6} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
              Kayıt Ol
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-text-muted">
            Zaten hesabınız var mı?{' '}
            <Link to="/login" className="text-accent hover:underline font-semibold">Giriş Yap</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
