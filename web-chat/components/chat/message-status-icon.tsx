import { MessageStatus } from '@/types/models';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface MessageStatusIconProps {
  status?: MessageStatus;
  className?: string;
  messageId?: string; // Add messageId for debugging
}

export function MessageStatusIcon({ status, className = '', messageId }: MessageStatusIconProps) {
  if (!status) return null;

  const iconStyle = { fontSize: 16 };

  // Debug: Log the status being rendered with messageId
  console.log(`[MessageStatusIcon][${messageId || 'unknown'}] Rendering status:`, status, 'Type:', typeof status);
  console.log(`[MessageStatusIcon][${messageId || 'unknown'}] Comparing:`, status, '===', MessageStatus.READ, '?', status === MessageStatus.READ);
  console.log(`[MessageStatusIcon][${messageId || 'unknown'}] String compare:`, status, '=== "READ" ?', status === 'READ');

  // Normalize status to handle both string and enum
  const normalizedStatus = status as string;

  switch (normalizedStatus) {
    case 'PENDING':
    case MessageStatus.PENDING:
      return <AccessTimeIcon sx={iconStyle} className={`text-gray-400 ${className}`} />;

    case 'SENDING':
    case MessageStatus.SENDING:
      return <AccessTimeIcon sx={iconStyle} className={className} />;

    case 'SENT':
    case MessageStatus.SENT:
      return <DoneIcon sx={iconStyle} className={className} />;

    case 'DELIVERED':
    case MessageStatus.DELIVERED:
      return <DoneAllIcon sx={iconStyle} className={className} />;

    case 'READ':
    case MessageStatus.READ:
      console.log(`[MessageStatusIcon][${messageId || 'unknown'}] ✅ Rendering BLUE double checkmark for READ status`);
      return <DoneAllIcon sx={iconStyle} className={`text-cyan-400 ${className}`} />;

    case 'FAILED':
    case MessageStatus.FAILED:
      return <ErrorOutlineIcon sx={iconStyle} className={`text-red-500 ${className}`} />;

    default:
      console.warn('[MessageStatusIcon] Unknown status:', status);
      return null;
  }
}
