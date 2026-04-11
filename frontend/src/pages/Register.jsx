import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ErrorAlert } from '../components/ui/Feedback';
import { Activity } from 'lucide-react';

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
      setError(err.response?.data?.error || 'Kayıt olunamadı. Farklı bir e-posta deneyin.');
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
        <h2 className="text-2xl font-semibold mb-6 text-center">Hesap Oluştur</h2>
        
        <ErrorAlert message={error} />
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input 
            label="Ad Soyad" 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="John Doe"
          />
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
            placeholder="En az 6 karakter"
            minLength={6}
          />
          
          <Button type="submit" loading={loading} className="w-full mt-4">
            Kayıt Ol
          </Button>
        </form>
        
        <div className="mt-6 text-center text-gray-400">
          Zaten hesabınız var mı?{' '}
          <Link to="/login" className="text-[#00d4ff] hover:underline font-medium">
            Giriş Yapın
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Register;
