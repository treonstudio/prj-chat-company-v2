'use client'
import { useAuthContext } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoadingScreen from "@/components/LoadingScreen";

function Page() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    // Wait for loading to complete before checking auth
    if (!loading && user == null) {
      router.push("/signin");
    }
  }, [user, loading, router]);

  // Show loading state
  if (loading) {
    return <LoadingScreen />;
  }

  // Show content only if user is authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <h1 className="mb-4 text-3xl font-bold text-gray-900">
            Welcome, {user.email || user.displayName || 'User'}!
          </h1>
          <p className="text-gray-600">
            Only logged-in users can view this page.
          </p>
          <div className="mt-6 rounded-lg bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">
              <strong>User ID:</strong> {user.uid}
            </p>
            <p className="text-sm text-emerald-800">
              <strong>Email:</strong> {user.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Page;
