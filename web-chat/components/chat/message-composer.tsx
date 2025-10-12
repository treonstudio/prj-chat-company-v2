'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendIcon } from 'lucide-react';

interface MessageComposerProps {
  onSendText: (text: string) => void;
  disabled?: boolean;
}

export function MessageComposer({
  onSendText,
  disabled = false,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendText(message);
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3">
      {/* Message input */}
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        disabled={disabled}
        className="flex-1"
      />

      {/* Send button */}
      <Button type="submit" size="icon" disabled={!message.trim() || disabled}>
        <SendIcon className="h-5 w-5" />
      </Button>
    </form>
  );
}
