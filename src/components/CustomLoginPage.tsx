import React, { useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { API_BASE } from '../constants';

interface CustomLoginPageProps {
  onLoginSuccess: () => void;
}

export default function CustomLoginPage({ onLoginSuccess }: CustomLoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    console.time("LoginRequest");
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      console.timeEnd("LoginRequest");
      if (data.success) {
        onLoginSuccess();
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-6xl font-black text-white tracking-tighter">
            MINN <span className="text-[#0097A7]">STUDIO</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium">Restricted Access</p>
        </div>
        
        <div className="p-8 bg-[#111111] border border-[#1a1a1a] rounded-3xl space-y-6 shadow-2xl">
          <div className="flex justify-center">
            <div className="p-4 bg-[#0097A7]/10 rounded-full">
              <ShieldCheck className="w-12 h-12 text-[#0097A7]" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Admin Login</h2>
            <p className="text-gray-500 text-xs">Enter your credentials to access the studio.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1 text-left">
              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-[#2a2a2a] rounded-xl p-3 text-white focus:outline-none focus:border-[#0097A7] transition-all"
                placeholder="Admin username"
                required
              />
            </div>
            
            <div className="space-y-1 text-left">
              <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-[#2a2a2a] rounded-xl p-3 text-white focus:outline-none focus:border-[#0097A7] transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-950/20 border border-red-500/30 rounded-xl text-red-500 text-xs">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#0097A7] hover:bg-[#00838F] text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'SIGN IN'
              )}
            </button>
          </form>
        </div>
        
        <p className="text-[10px] text-gray-700 uppercase font-bold tracking-widest">Authorized Personnel Only</p>
      </div>
    </div>
  );
}
