import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ErrorAlert } from '../components/ui/Feedback';
import { Activity } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Giriş yapılamadı. Bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e27] flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-3">
        <Activity size={40} className="text-[#00d4ff]" />
        <h1 className="text-4xl font-bold text-gradient">FinansRadar</h1>
      </div>
      
      <Card className="w-full max-w-md p-8 shadow-[0_0_40px_rgba(0,212,255,0.1)]">
        <h2 className="text-2xl font-semibold mb-6 text-center">Hoş Geldiniz</h2>
        
        <ErrorAlert message={error} />
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input 
            label="E-posta Adresi" 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="ornek@email.com"
          />
          <Input 
            label="Şifre" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
          
          <Button type="submit" loading={loading} className="w-full mt-4">
            Giriş Yap
          </Button>
        </form>
        
        <div className="mt-6 text-center text-gray-400">
          Hesabınız yok mu?{' '}
          <Link to="/register" className="text-[#00d4ff] hover:underline font-medium">
            Kayıt Olun
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Login;
