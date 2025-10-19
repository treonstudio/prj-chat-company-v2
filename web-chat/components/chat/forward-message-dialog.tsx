'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Users, Loader2 } from 'lucide-react'
import { useChatList } from '@/lib/hooks/use-chat-list'
import { cn } from '@/lib/utils'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

interface ForwardMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onForward: (chatId: string, isGroup: boolean) => Promise<void>
  currentUserId: string
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  onForward,
  currentUserId,
}: ForwardMessageDialogProps) {
  const [query, setQuery] = useState('')
  const [forwardingChatId, setForwardingChatId] = useState<string | null>(null)

  const { chats, loading, error } = useChatList(currentUserId)

  const filtered = useMemo(() => {
    if (!query) return chats
    const q = query.toLowerCase()
    return chats.filter((c) => {
      const name = c.chatType === 'GROUP' ? c.groupName : c.otherUserName
      return name?.toLowerCase().includes(q)
    })
  }, [chats, query])

  const handleChatClick = async (chatId: string, isGroup: boolean) => {
    setForwardingChatId(chatId)
    try {
      await onForward(chatId, isGroup)
      setQuery('')
      onOpenChange(false)
    } catch (error) {
      console.error('Forward error:', error)
    } finally {
      setForwardingChatId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogTitle asChild>
          <VisuallyHidden>Forward Message</VisuallyHidden>
        </DialogTitle>
        <div className="flex flex-col h-[600px]">
          {/* Header */}
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold mb-4">Forward message to</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or number"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Recent chats label */}
          <div className="px-6 py-2 bg-muted/30">
            <p className="text-sm font-medium text-muted-foreground">Recent chats</p>
          </div>

          {/* Chat list */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <p className="text-sm text-muted-foreground">
                  {query ? 'No chats found' : 'No chats yet'}
                </p>
                {!query && chats.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Total chats: {chats.length}
                  </p>
                )}
              </div>
            ) : (
              <div className="px-4 py-2">
                {filtered.map((chat) => {
                  const name = chat.chatType === 'GROUP' ? chat.groupName : chat.otherUserName
                  const avatar = chat.chatType === 'GROUP' ? chat.groupAvatar : chat.otherUserAvatar
                  const isGroup = chat.chatType === 'GROUP'
                  const isForwarding = forwardingChatId === chat.chatId
                  const displayName = name && name.trim() !== '' ? name : 'Unknown'

                  return (
                    <button
                      key={chat.chatId}
                      onClick={() => handleChatClick(chat.chatId, isGroup)}
                      disabled={forwardingChatId !== null}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={avatar || "/placeholder-user.jpg"} alt="" />
                        <AvatarFallback>
                          {isGroup ? (
                            <Users className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            displayName.slice(0, 2).toUpperCase()
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium truncate">{displayName}</p>
                        {chat.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate">
                            {chat.lastMessage.length > 35
                              ? chat.lastMessage.slice(0, 35) + '...'
                              : chat.lastMessage}
                          </p>
                        )}
                      </div>
                      {isForwarding && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
