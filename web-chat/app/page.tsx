'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/chat/sidebar';
import { ChatRoom } from '@/components/chat/chat-room';
import { useAuth } from '@/lib/contexts/auth.context';

export default function Page() {
  const { currentUser, userData, loading } = useAuth();
  const router = useRouter();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatIsGroup, setSelectedChatIsGroup] = useState(false);

  useEffect(() => {
    if (!loading && (!currentUser || !userData)) {
      router.push('/login');
    }
  }, [currentUser, userData, loading, router]);

  if (loading) {
    return (
      <div className="theme-mint flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!currentUser || !userData) {
    return null;
  }

  return (
    <main className="theme-mint h-dvh overflow-hidden">
      <div className="flex h-dvh w-full flex-col overflow-hidden md:flex-row min-h-0">
        <aside className="h-full w-full overflow-hidden border-b md:w-[360px] md:border-r md:border-b-0 min-h-0">
          <Sidebar
            currentUserId={currentUser.uid}
            currentUserName={userData.displayName}
            currentUserData={userData}
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
              currentUserAvatar={userData.imageURL || userData.imageUrl}
              isGroupChat={selectedChatIsGroup}
              onLeaveGroup={() => {
                // Reset to no chat selected after leaving
                setSelectedChatId(null);
                setSelectedChatIsGroup(false);
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg">Select a chat to start messaging</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
