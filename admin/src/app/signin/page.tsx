'use client'
import signIn from "@/firebase/auth/signIn";
import { useRouter } from 'next/navigation';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

function Page() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Handle form submission
  const handleForm = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    setUsernameError('');
    setPasswordError('');

    // Client-side validation
    let hasError = false;

    if (!username.trim()) {
      setUsernameError('Username tidak boleh kosong');
      hasError = true;
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
      // Try Firebase authentication with username
      const { result, error } = await signIn(username, password);

      if (error) {
        // Handle specific Firebase errors
        const firebaseError = error as any;

        if (firebaseError.code === 'auth/user-not-found') {
          setUsernameError('Username tidak ditemukan');
          toast.error('Login gagal', {
            description: 'Username tidak ditemukan'
          });
        } else if (firebaseError.code === 'auth/wrong-password') {
          setPasswordError('Password salah');
          toast.error('Login gagal', {
            description: 'Password salah'
          });
        } else if (firebaseError.code === 'auth/invalid-email') {
          setUsernameError('Format username tidak valid');
          toast.error('Login gagal', {
            description: 'Format username tidak valid'
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
          setError('Username atau password salah. Silakan periksa kembali.');
          toast.error('Login gagal', {
            description: 'Username atau password salah'
          });
        } else if (firebaseError.code === 'auth/access-denied') {
          setError('Akses ditolak. Hanya admin yang dapat login.');
          toast.error('Login gagal', {
            description: 'Akses ditolak. Hanya admin yang dapat login.'
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
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#f6f1eb' }}>
      {/* Multiple Soft Gradient Blur Layers */}
      <div className="absolute top-0 -left-20 w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-[150px] animate-pulse"></div>
      <div className="absolute bottom-0 -right-20 w-[500px] h-[500px] bg-teal-200/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-green-200/15 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-teal-300/10 via-emerald-200/5 to-green-300/10 blur-[120px]"></div>
      <div className="absolute inset-0 bg-gradient-to-bl from-green-200/10 via-teal-100/5 to-emerald-300/10 blur-[120px]"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-100/5 via-transparent to-teal-200/5 blur-3xl"></div>

      {/* Content */}
      <Card className="w-full max-w-md border-0 shadow-2xl relative z-10 backdrop-blur-sm bg-white/95">
        <CardContent className="p-8">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <Image
                src="/logo.png"
                alt="Chatku Logo"
                width={80}
                height={80}
                className="h-20 w-auto"
                priority
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-700">Chatku Admin</h1>
            <p className="mt-2 text-sm text-gray-500">Sign in to your account</p>
          </div>

          <form onSubmit={handleForm} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-500">
                Username
              </label>
              <Input
                onChange={(e) => {
                  setUsername(e.target.value)
                  setUsernameError('')
                }}
                type="text"
                name="username"
                id="username"
                placeholder="Enter your username"
                className={`h-12 text-gray-700 placeholder:text-gray-400 focus:ring-0 shadow-none ${usernameError ? "focus:border-red-300" : "focus:border-emerald-300"}`}
                style={{ borderColor: usernameError ? '#fca5a5' : '#e6e7ea', borderWidth: '1.6px' }}
                value={username}
                disabled={loading}
              />
              {usernameError && (
                <p className="mt-1 text-xs text-red-600">{usernameError}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-500">
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
                  className={`h-12 pr-10 text-gray-700 placeholder:text-gray-400 focus:ring-0 shadow-none ${passwordError ? "focus:border-red-300" : "focus:border-emerald-300"}`}
                  style={{ borderColor: passwordError ? '#fca5a5' : '#e6e7ea', borderWidth: '1.6px' }}
                  value={password}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
