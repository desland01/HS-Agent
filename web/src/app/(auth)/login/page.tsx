'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Zap, Mail, Lock, ArrowLeft } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import { useAuthStore } from '@/lib/stores';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Demo login - in production, call the API
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock successful login
      setAuth(
        {
          id: 'user_demo',
          email: email,
          name: email.split('@')[0],
        },
        'demo_token_123'
      );

      router.push('/leads');
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      {/* Back button */}
      <div className="p-4 sm:p-6">
        <Button variant="ghost" onClick={() => router.push('/')}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center gap-2 mb-4"
            >
              <div className="w-10 h-10 rounded-xl bg-accent-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="font-display font-bold text-2xl text-navy-900">
                HomeServiceAI
              </span>
            </motion.div>
            <h1 className="text-2xl font-display font-bold text-navy-900">
              Welcome back
            </h1>
            <p className="text-navy-500 mt-2">
              Sign in to manage your leads and conversations
            </p>
          </div>

          {/* Login Form */}
          <Card padding="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 rounded-lg bg-danger-50 text-danger-700 text-sm"
                >
                  {error}
                </motion.div>
              )}

              <Input
                label="Email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-navy-300 text-accent-500 focus:ring-accent-500"
                  />
                  <span className="text-navy-600">Remember me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-accent-600 hover:text-accent-700"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={isLoading}
              >
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-navy-500">
              Do not have an account?{' '}
              <Link
                href="/signup"
                className="font-medium text-accent-600 hover:text-accent-700"
              >
                Sign up for free
              </Link>
            </div>
          </Card>

          {/* Demo hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 p-4 rounded-lg bg-navy-100/50 text-center"
          >
            <p className="text-sm text-navy-600">
              <strong>Demo Mode:</strong> Enter any email and password to explore
              the dashboard.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
