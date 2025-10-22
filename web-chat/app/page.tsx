'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/chat/sidebar';
import { ChatRoom } from '@/components/chat/chat-room';
import { useAuth } from '@/lib/contexts/auth.context';
import packageJson from '../package.json';

// Get commit hash - will be set during build
const COMMIT_HASH = process.env.NEXT_PUBLIC_COMMIT_HASH || '539132f';

export default function Page() {
  const { currentUser, userData, loading } = useAuth();
  const router = useRouter();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatIsGroup, setSelectedChatIsGroup] = useState(false);
  const [avatarCacheKey, setAvatarCacheKey] = useState(Date.now());

  useEffect(() => {
    if (!loading && (!currentUser || !userData)) {
      router.push('/login');
    }
  }, [currentUser, userData, loading, router]);

  // Update cache key when avatar URL changes to force image reload
  useEffect(() => {
    if (userData?.imageURL || userData?.imageUrl) {
      setAvatarCacheKey(Date.now());
    }
  }, [userData?.imageURL, userData?.imageUrl]);

  if (loading) {
    return (
      <div className="theme-mint flex h-screen items-center justify-center" style={{ backgroundColor: '#f0f2f5' }}>
        <div className="flex flex-col items-center gap-6">
          {/* Chatku logo */}
          <div className="relative">
            <img
              src="/logo-chatku.png"
              alt="Chatku Logo"
              width={160}
              height={60}
              className="object-contain"
            />
          </div>

          {/* App name */}
          <h1 className="text-2xl font-normal text-[#41525d]">Chatku Web</h1>

          {/* Progress bar */}
          <div className="w-64 h-1 bg-[#dfe5e7] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00a884] rounded-full"
              style={{
                animation: 'loading-progress 1.5s ease-in-out infinite'
              }}
            />
          </div>

          {/* Version info */}
          <div className="flex items-center gap-1.5 text-xs text-[#667781] mt-8">
            <span>Chatku Web v{packageJson.version}(#{COMMIT_HASH}) by TreonStudio</span>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes loading-progress {
              0% {
                width: 0%;
                margin-left: 0%;
              }
              50% {
                width: 75%;
                margin-left: 0%;
              }
              100% {
                width: 0%;
                margin-left: 100%;
              }
            }
          `
        }} />
      </div>
    );
  }

  if (!currentUser || !userData) {
    return null;
  }

  // Add cache busting to avatar URL for real-time updates
  const currentUserAvatar = userData.imageURL || userData.imageUrl
    ? `${userData.imageURL || userData.imageUrl}?t=${avatarCacheKey}`
    : undefined

  return (
    <main className="theme-mint h-dvh overflow-hidden">
      <div className="flex h-dvh w-full flex-col overflow-hidden md:flex-row min-h-0">
        <aside className="h-full w-full overflow-hidden border-b md:w-[360px] md:border-r md:border-b-0 min-h-0">
          <Sidebar
            currentUserId={currentUser.uid}
            currentUserName={userData.displayName}
            currentUserData={userData}
            selectedChatId={selectedChatId}
            onChatSelect={(chatId, isGroup) => {
              setSelectedChatId(chatId);
              setSelectedChatIsGroup(isGroup);
            }}
          />
        </aside>
        <section className="flex h-full flex-1 overflow-hidden min-h-0">
          {selectedChatId ? (
            <ChatRoom
              chatId={selectedChatId}
              currentUserId={currentUser.uid}
              currentUserName={userData.displayName}
              currentUserAvatar={currentUserAvatar}
              isGroupChat={selectedChatIsGroup}
              onLeaveGroup={() => {
                // Reset to no chat selected after leaving
                setSelectedChatId(null);
                setSelectedChatIsGroup(false);
              }}
              onCloseChat={() => {
                // Close chat and return to chat list
                setSelectedChatId(null);
                setSelectedChatIsGroup(false);
              }}
              onChatSelect={(chatId, isGroup) => {
                setSelectedChatId(chatId);
                setSelectedChatIsGroup(isGroup);
              }}
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center border-b border-border"
              style={{ backgroundColor: '#f0f2f5' }}
            >
              <div className="flex flex-col items-center gap-4 px-8 py-12">
                {/* Illustration */}
                <div className="relative h-40 w-40">
                  <img
                    src="/illus-start-message.webp"
                    alt="Start messaging illustration"
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Title */}
                <h1 className="text-2xl font-light text-[#41525d]">
                  Mulai percakapan
                </h1>

                {/* Description */}
                <p className="text-center text-sm text-[#667781] max-w-md">
                  Kirim dan terima pesan dengan cepat langsung dari browser Anda.
                  Pilih percakapan untuk mulai mengirim pesan.
                </p>
              </div>

              {/* Footer */}
              <div className="absolute bottom-6 flex items-center gap-1.5 text-xs text-[#667781]">
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  className="text-[#667781]"
                  fill="currentColor"
                >
                  <path d="M8 0C3.6 0 0 3.1 0 7c0 1.7.7 3.2 1.8 4.4L.5 14.1c-.1.3 0 .6.2.8.2.2.5.2.8.1l2.7-1.3C5.2 14.6 6.6 15 8 15c4.4 0 8-3.1 8-7s-3.6-8-8-8zm0 13.5c-1.3 0-2.5-.3-3.6-.9l-.3-.2-2.2 1.1.9-2.2-.2-.3C1.7 9.8 1.5 8.4 1.5 7c0-3.1 2.9-5.5 6.5-5.5s6.5 2.4 6.5 5.5-2.9 6.5-6.5 6.5z"/>
                </svg>
                <span>Chatku Web powered by TreonStudio</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
