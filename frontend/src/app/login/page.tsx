'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await api.login({ email, password });
      
      if (result.message === 'Login successful') {
        router.push('/library');
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="shadow-lg border-b" style={{ backgroundColor: 'white', borderColor: '#e2e8f0', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="text-3xl font-bold flex items-center" style={{ color: '#374151', fontFamily: 'Inter, sans-serif' }}>
                <img src="/rr-logo.png" alt="Riveting Reads" className="w-8 h-8 mr-3" />
                Riveting Reads
              </Link>
            </div>
            <nav className="flex items-center space-x-4">
              <Link
                href="/signup"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Sign Up
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8" style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)' }}>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-3" style={{ color: '#374151', fontFamily: 'Inter, sans-serif' }}>Welcome Back</h1>
              <p className="text-gray-600 text-lg">Sign in to continue your Spanish learning journey</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl font-medium">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg"
                  placeholder="Enter your email"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg"
                  placeholder="Enter your password"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full text-white py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                style={{ backgroundColor: '#3b82f6', boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)', fontFamily: 'Inter, sans-serif' }}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="text-center mt-8 space-y-4">
              <p className="text-gray-600 text-lg">
                Don't have an account?{' '}
                <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-bold transition-colors">
                  Sign up
                </Link>
              </p>
              
              <div className="border-t pt-4">
                <p className="text-gray-600">
                  Admin access?{' '}
                  <Link href="/admin/login" className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
                    ⚙️ Admin Login
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}