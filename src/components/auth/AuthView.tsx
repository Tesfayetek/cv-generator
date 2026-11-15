import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, FileText, Layers, Lock, Mail, Sparkles, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthViewProps {
  appName: string;
  tagline: string;
  onBrowseTemplatesPublic?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  appName,
  tagline,
  onBrowseTemplatesPublic,
}) => {
  const { signInWithGoogle, registerWithEmail, loginWithEmail, sendResetEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      if (mode === 'register') {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        await registerWithEmail(fullName, email, password);
        setNotice('Account created. A verification link has been sent to your email address.');
      } else if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await sendResetEmail(email);
        setNotice('Password reset instructions have been sent to your email address.');
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/password authentication is not yet enabled in Firebase Console. Please sign in with Google below, or enable Email/Password under Firebase Authentication > Sign-in method.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Invalid email or password. Please verify your credentials or reset your password.');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Switch to Sign In.');
      } else {
        setError(err?.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Google sign-in could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Clean 3-zone Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-4 flex items-center justify-between gap-8">
        <div className="text-lg font-bold tracking-tight text-[#142B4A] whitespace-nowrap shrink-0 font-display">
          {appName}
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {onBrowseTemplatesPublic && (
            <button
              onClick={onBrowseTemplatesPublic}
              className="hover:text-[#142B4A] transition-colors whitespace-nowrap shrink-0"
            >
              Template Gallery
            </button>
          )}
          <a href="#features" className="hover:text-[#142B4A] transition-colors whitespace-nowrap shrink-0">
            Capabilities
          </a>
        </nav>
        <div className="shrink-0">
          <button
            onClick={handleGoogle}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#142B4A] hover:bg-[#1e3d66] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Sign In
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 lg:py-16 grid lg:grid-cols-12 gap-10 items-stretch">
        {/* Left Value Column */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-8">
          <div>
            <p className="text-sm font-semibold text-[#2864A6] tracking-wide mb-3">
              {tagline}
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-[#142B4A] leading-[1.15] tracking-tight text-balance">
              Design executive, NGO, academic, and modern CVs with full typographic control.
            </h1>
            <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-2xl">
              Start from scratch, extract an existing DOCX or PDF resume, or build with AI writing and natural-language layout generation across 35 distinct templates.
            </p>

            <div className="mt-8 grid sm:grid-cols-2 gap-4" id="features">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2.5 text-[#142B4A] font-semibold text-sm">
                  <Layers className="w-4 h-4 text-[#2864A6]" />
                  35 Distinct Templates
                </div>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Switch between Classic, Executive, NGO, Academic, Tech, and Entry-Level layouts without retyping your CV.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2.5 text-[#142B4A] font-semibold text-sm">
                  <Sparkles className="w-4 h-4 text-[#2864A6]" />
                  AI Design & Writing Engine
                </div>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Describe any layout in plain English or refine achievements truthfully with job-description keyword matching.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2.5 text-[#142B4A] font-semibold text-sm">
                  <FileText className="w-4 h-4 text-[#2864A6]" />
                  Vector PDF & Editable DOCX
                </div>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Export selectable-text A4 or US Letter PDFs and fully editable Microsoft Word documents.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2.5 text-[#142B4A] font-semibold text-sm">
                  <UserCheck className="w-4 h-4 text-[#2864A6]" />
                  ATS Readiness Controls
                </div>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Toggle single-column linear reading mode and audit headings, fonts, and keyword clarity before applying.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200 bg-white relative h-52">
            <img
              src="/src/assets/images/editorial_desk_preview_1794735925795.jpg"
              alt="Editorial CV layout stationery"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#142B4A]/80 via-[#142B4A]/20 to-transparent flex items-end p-5">
              <div className="text-white text-sm font-medium">
                Live A4 & US Letter page rendering with multi-page break accuracy
              </div>
            </div>
          </div>
        </div>

        {/* Right Auth Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setNotice(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'login' ? 'bg-white text-[#142B4A] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); setNotice(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'register' ? 'bg-white text-[#142B4A] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Free Account
            </button>
          </div>

          <h2 className="text-xl font-bold text-[#142B4A]">
            {mode === 'login'
              ? 'Access your CV workspace'
              : mode === 'register'
              ? 'Create your free account'
              : 'Reset your password'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'forgot'
              ? 'Enter your account email to receive a password reset link.'
              : 'Your CVs, custom templates, and design history are privately synced to your account.'}
          </p>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
              {error}
            </div>
          )}

          {notice && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Amara Okafor"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2864A6]/30 focus:border-[#2864A6]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2864A6]/30 focus:border-[#2864A6]"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}
                      className="text-xs font-medium text-[#2864A6] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2864A6]/30 focus:border-[#2864A6]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-[#142B4A] hover:bg-[#1e3d66] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>
                {submitting
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                  ? 'Register Free Account'
                  : 'Send Reset Link'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setNotice(''); }}
                className="w-full text-xs font-medium text-slate-600 hover:text-slate-900 py-1"
              >
                Back to Sign In
              </button>
            )}
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or continue instantly</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogle}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          {onBrowseTemplatesPublic && (
            <button
              type="button"
              onClick={onBrowseTemplatesPublic}
              className="mt-4 w-full text-center text-xs font-semibold text-[#2864A6] hover:text-[#142B4A] transition-colors"
            >
              Preview 35+ Templates Before Signing In
            </button>
          )}
        </div>
      </main>
    </div>
  );
};
