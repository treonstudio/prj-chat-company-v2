import { MessageStatus } from '@/types/models';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface MessageStatusIconProps {
  status?: MessageStatus;
  className?: string;
}

export function MessageStatusIcon({ status, className = '' }: MessageStatusIconProps) {
  if (!status) return null;

  const iconStyle = { fontSize: 16 };

  switch (status) {
    case MessageStatus.SENDING:
      return <AccessTimeIcon sx={iconStyle} className={className} />;

    case MessageStatus.SENT:
      return <DoneIcon sx={iconStyle} className={className} />;

    case MessageStatus.DELIVERED:
      return <DoneAllIcon sx={iconStyle} className={className} />;

    case MessageStatus.READ:
      return <DoneAllIcon sx={iconStyle} className={`text-blue-500 ${className}`} />;

    case MessageStatus.FAILED:
      return <ErrorOutlineIcon sx={iconStyle} className={`text-red-500 ${className}`} />;

    default:
      return null;
  }
}
