'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Zap, User, Mail, Lock, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import { useAuthStore } from '@/lib/stores';

export default function SignupPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Demo signup - in production, call the API
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock successful signup
      setAuth(
        {
          id: 'user_new',
          email: email,
          name: name,
        },
        'new_user_token_123'
      );

      // Redirect to onboarding
      router.push('/onboarding');
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    'AI-powered lead qualification',
    'Automated follow-ups',
    'Real-time conversation tracking',
    'No credit card required',
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col lg:flex-row">
      {/* Left side - Benefits */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy-900 text-white p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 rounded-xl bg-accent-500 flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <span className="font-display font-bold text-2xl">HomeServiceAI</span>
          </div>

          <h2 className="text-4xl font-display font-bold mb-6">
            Start converting more leads today
          </h2>
          <p className="text-navy-300 text-lg mb-12">
            Join hundreds of home service businesses using AI to grow their revenue.
          </p>

          <ul className="space-y-4">
            {benefits.map((benefit, index) => (
              <motion.li
                key={benefit}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-accent-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-accent-400" />
                </div>
                <span className="text-navy-200">{benefit}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="border-t border-navy-700 pt-8">
          <blockquote className="text-navy-300 italic">
            &quot;HomeServiceAI helped us respond to leads 10x faster. Our booking rate
            jumped 40% in the first month.&quot;
          </blockquote>
          <p className="mt-4 text-white font-medium">Mike Johnson</p>
          <p className="text-navy-400 text-sm">Owner, Premium Painting Co.</p>
        </div>
      </div>

      {/* Right side - Signup Form */}
      <div className="flex-1 flex flex-col">
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
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent-500 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <span className="font-display font-bold text-2xl text-navy-900">
                  HomeServiceAI
                </span>
              </div>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-display font-bold text-navy-900">
                Create your account
              </h1>
              <p className="text-navy-500 mt-2">
                Set up your AI agent in under 5 minutes
              </p>
            </div>

            {/* Signup Form */}
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
                  label="Full Name"
                  type="text"
                  placeholder="John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  leftIcon={<User className="w-4 h-4" />}
                  required
                />

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
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  hint="At least 8 characters"
                  required
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  loading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create Account
                </Button>
              </form>

              <p className="mt-6 text-xs text-navy-400 text-center">
                By signing up, you agree to our{' '}
                <Link href="/terms" className="underline hover:text-navy-600">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="underline hover:text-navy-600">
                  Privacy Policy
                </Link>
                .
              </p>

              <div className="mt-6 text-center text-sm text-navy-500">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-medium text-accent-600 hover:text-accent-700"
                >
                  Sign in
                </Link>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
