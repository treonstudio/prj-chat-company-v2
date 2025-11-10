'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth.context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PresenceRepository } from '@/lib/repositories/presence.repository';

const EMAIL_DOMAIN = '@chatapp.com';

const presenceRepository = new PresenceRepository();

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [existingSessions, setExistingSessions] = useState<{ deviceId: string, deviceName: string }[]>([]);
  const [pendingLoginData, setPendingLoginData] = useState<{ email: string, password: string, userId: string } | null>(null);
  const router = useRouter();
  const { signIn, signOut, currentUser, userData } = useAuth();

  // Redirect to home if already logged in
  useEffect(() => {
    if (currentUser && userData) {
      router.push('/');
    }
  }, [currentUser, userData, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Convert username to email format
      const email = username + EMAIL_DOMAIN;

      console.log('[Login] Checking for existing sessions...');

      // Step 1: Get userId from username WITHOUT signing in
      const userId = await presenceRepository.getUserIdByUsername(username);

      if (userId) {
        // Step 2: Check if user has existing web sessions in RTDB
        const sessions = await presenceRepository.checkExistingSessions(userId, 'web');

        if (sessions.length > 0) {
          // Found existing sessions, show dialog
          console.log('[Login] Found existing sessions:', sessions);
          setExistingSessions(sessions);
          setPendingLoginData({ email, password, userId });
          setShowSessionDialog(true);
          setLoading(false);
          return;
        }
      }

      // No existing sessions, proceed with normal login
      await proceedWithLogin(email, password);
    } catch (error: any) {
      console.error('[Login] Error:', error);
      const errorMessage = error.message || 'Gagal login';
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  const proceedWithLogin = async (email: string, password: string) => {
    const result = await signIn(email, password);

    if (result.success) {
      toast.success('Login berhasil! Mengalihkan...');
      router.push('/');
    } else {
      const errorMessage = result.error || 'Gagal login';
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  const handleConfirmLogin = async () => {
    if (!pendingLoginData) return;

    setShowSessionDialog(false);
    setLoading(true);

    try {
      // Kick out all existing sessions
      for (const session of existingSessions) {
        console.log('[Login] Kicking out session:', session.deviceId);
        await presenceRepository.kickOutDevice(pendingLoginData.userId, 'web', session.deviceId);
      }

      // Small delay to ensure sessions are kicked out
      await new Promise(resolve => setTimeout(resolve, 500));

      // Proceed with login
      await proceedWithLogin(pendingLoginData.email, pendingLoginData.password);

      // Clear pending data
      setPendingLoginData(null);
      setExistingSessions([]);
    } catch (error) {
      console.error('[Login] Error during login:', error);
      toast.error('Gagal login. Silakan coba lagi.');
      setLoading(false);
    }
  };

  const handleCancelLogin = () => {
    setShowSessionDialog(false);
    setPendingLoginData(null);
    setExistingSessions([]);
    setLoading(false);
  };

  return (
    <div className="theme-mint flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Welcome to BC</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-2">
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username (e.g., kiki)"
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </Card>

      {/* Session Conflict Dialog */}
      <AlertDialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Device Lain Terdeteksi</AlertDialogTitle>
            <AlertDialogDescription>
              Anda sedang login di device lain. Apakah Anda ingin login di device ini dan logout dari device lain?
              {existingSessions.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="font-medium text-sm">Device aktif:</p>
                  <ul className="list-disc list-inside text-sm">
                    {existingSessions.map((session) => (
                      <li key={session.deviceId}>{session.deviceName}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelLogin}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLogin}>
              Ya, Login di Sini
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
