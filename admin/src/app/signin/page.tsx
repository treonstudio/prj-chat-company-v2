'use client'
import signIn from "@/firebase/auth/signIn";
import { useRouter } from 'next/navigation';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

function Page() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Handle form submission
  const handleForm = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    setEmailError('');
    setPasswordError('');

    // Client-side validation
    let hasError = false;

    if (!email.trim()) {
      setEmailError('Email tidak boleh kosong');
      hasError = true;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setEmailError('Format email tidak valid');
        hasError = true;
      }
    }

    if (!password) {
      setPasswordError('Password tidak boleh kosong');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);

    try {
      // Try Firebase authentication
      const { result, error } = await signIn(email, password);

      if (error) {
        // Handle specific Firebase errors
        const firebaseError = error as any;

        if (firebaseError.code === 'auth/user-not-found') {
          setEmailError('Tidak ada akun dengan email ini');
          toast.error('Login gagal', {
            description: 'Tidak ada akun dengan email ini'
          });
        } else if (firebaseError.code === 'auth/wrong-password') {
          setPasswordError('Password salah');
          toast.error('Login gagal', {
            description: 'Password salah'
          });
        } else if (firebaseError.code === 'auth/invalid-email') {
          setEmailError('Format email tidak valid');
          toast.error('Login gagal', {
            description: 'Format email tidak valid'
          });
        } else if (firebaseError.code === 'auth/user-disabled') {
          setError('Akun ini telah dinonaktifkan');
          toast.error('Login gagal', {
            description: 'Akun ini telah dinonaktifkan'
          });
        } else if (firebaseError.code === 'auth/too-many-requests') {
          setError('Terlalu banyak percobaan gagal. Silakan coba lagi nanti.');
          toast.error('Login gagal', {
            description: 'Terlalu banyak percobaan gagal. Silakan coba lagi nanti.'
          });
        } else if (firebaseError.code === 'auth/invalid-credential') {
          setError('Email atau password salah. Silakan periksa kembali.');
          toast.error('Login gagal', {
            description: 'Email atau password salah'
          });
        } else {
          setError('Terjadi kesalahan. Silakan coba lagi.');
          toast.error('Login gagal', {
            description: 'Terjadi kesalahan'
          });
        }

        setLoading(false);
        return;
      }

      // Sign in successful
      console.log('User signed in successfully:', result);

      // Show success toast
      toast.success('Login berhasil!', {
        description: 'Mengalihkan ke dashboard...'
      });

      // Redirect to the dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error('Unexpected error during sign in:', err);
      const errorMsg = 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi.';
      setError(errorMsg);
      toast.error('Login gagal', {
        description: errorMsg
      });
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="p-8">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-500">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-10 w-10 text-white"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Chatzy Admin</h1>
            <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
          </div>

          <form onSubmit={handleForm} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                Email
              </label>
              <Input
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailError('')
                }}
                type="email"
                name="email"
                id="email"
                placeholder="your.email@example.com"
                className={`h-12 ${emailError ? "border-red-500 focus:border-red-500" : ""}`}
                value={email}
                disabled={loading}
              />
              {emailError && (
                <p className="mt-1 text-xs text-red-600">{emailError}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <Input
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setPasswordError('')
                  }}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  id="password"
                  placeholder="Enter your password"
                  className={`h-12 pr-10 ${passwordError ? "border-red-500 focus:border-red-500" : ""}`}
                  value={password}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1 text-xs text-red-600">{passwordError}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full bg-emerald-500 text-white hover:bg-emerald-600"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default Page;
