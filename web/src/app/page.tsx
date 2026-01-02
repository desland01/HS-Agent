'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, MessageSquare, Users, BarChart3, Zap } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/lib/stores';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/leads');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 glass">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-navy-900">
              HomeService<span className="text-accent-500">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/login')}>
              Sign In
            </Button>
            <Button onClick={() => router.push('/signup')}>
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-100 text-accent-700 text-sm font-medium mb-6"
            >
              <Zap className="w-4 h-4" />
              AI-Powered Lead Management
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-navy-900 leading-[1.1] mb-6">
              Convert More Leads.{' '}
              <span className="gradient-text">Automatically.</span>
            </h1>

            <p className="text-xl text-navy-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Your AI agent qualifies leads, books appointments, and follows up
              with prospects 24/7. Built specifically for home service businesses.
            </p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button size="lg" onClick={() => router.push('/signup')}>
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => router.push('/login')}>
                View Demo
              </Button>
            </motion.div>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-32 grid md:grid-cols-3 gap-8"
          >
            {[
              {
                icon: MessageSquare,
                title: 'Smart Conversations',
                description:
                  'AI agents that understand context, ask the right questions, and qualify leads like your best salesperson.',
              },
              {
                icon: Users,
                title: 'Lead Pipeline',
                description:
                  'Visual kanban board tracks every lead from first contact to closed deal. Never lose a prospect again.',
              },
              {
                icon: BarChart3,
                title: 'Real-time Analytics',
                description:
                  'See response times, conversion rates, and revenue metrics. Know exactly what is working.',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="card-hover p-8"
              >
                <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent-600" />
                </div>
                <h3 className="text-xl font-semibold text-navy-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-navy-500 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Social Proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-32 text-center"
          >
            <p className="text-navy-500 text-sm uppercase tracking-wider mb-8">
              Trusted by home service businesses
            </p>
            <div className="flex flex-wrap items-center justify-center gap-12">
              {['Painting', 'Cabinets', 'Roofing', 'HVAC', 'Plumbing'].map(
                (industry) => (
                  <div
                    key={industry}
                    className="text-navy-300 font-display font-semibold text-lg"
                  >
                    {industry}
                  </div>
                )
              )}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-navy-900">
              HomeServiceAI
            </span>
          </div>
          <p className="text-navy-500 text-sm">
            2024 HomeServiceAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
