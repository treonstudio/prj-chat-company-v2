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
      return <DoneAllIcon sx={iconStyle} className={`text-cyan-400 ${className}`} />;

    case 'FAILED':
    case MessageStatus.FAILED:
      return <ErrorOutlineIcon sx={iconStyle} className={`text-red-500 ${className}`} />;

    default:
      return null;
  }
}
