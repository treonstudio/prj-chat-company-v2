'use client'
import signIn from "@/firebase/auth/signIn";
import { useRouter } from 'next/navigation';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

function Page() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Handle form submission
  const handleForm = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    // Check for default admin credentials first
    if (email === 'admin@gmail.com' && password === 'Admin1234') {
      // Store admin session in localStorage
      localStorage.setItem('adminAuth', JSON.stringify({
        email: 'admin@gmail.com',
        uid: 'admin-default',
        displayName: 'Admin',
        isDefaultAdmin: true
      }));

      // Redirect to dashboard
      router.push("/dashboard");
      return;
    }

    // If not default admin, try Firebase authentication
    const { result, error } = await signIn(email, password);

    if (error) {
      // Display and log any sign-in errors
      setError('Invalid email or password. Please try again.');
      setLoading(false);
      return;
    }

    // Sign in successful
    console.log(result);

    // Redirect to the dashboard
    router.push("/dashboard");
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
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                name="email"
                id="email"
                placeholder="admin@gmail.com"
                className="h-12"
                value={email}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <Input
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  name="password"
                  id="password"
                  placeholder="Enter your password"
                  className="h-12 pr-10"
                  value={password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full bg-emerald-500 text-white hover:bg-emerald-600"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="mt-4 rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-600">Default Admin Account:</p>
              <p className="text-sm font-medium text-gray-900">admin@gmail.com</p>
              <p className="text-sm font-medium text-gray-900">Admin1234</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default Page;
