import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { id } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";

/**
 * Formats a timestamp for the chat list sidebar following these rules:
 * - Today: show time in HH:mm format
 * - Yesterday: show "Kemarin" (Yesterday in Indonesian)
 * - Within this week: show day of week in Indonesian (e.g., "Sen", "Sel", "Rab")
 * - Older: show date in DD/MM/YYYY format
 *
 * @param timestamp - Firestore Timestamp or null
 * @returns Formatted timestamp string in Indonesian
 */
export function formatChatListTimestamp(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return '';

  const messageDate = timestamp.toDate();

  // Today: show time (HH:mm)
  if (isToday(messageDate)) {
    return format(messageDate, 'HH:mm');
  }

  // Yesterday: show "Kemarin"
  if (isYesterday(messageDate)) {
    return 'Kemarin';
  }

  // Within this week: show day of week in Indonesian (e.g., "Sen", "Sel", "Rab")
  if (isThisWeek(messageDate, { weekStartsOn: 1 })) { // Week starts on Monday
    return format(messageDate, 'EEE', { locale: id }); // Short day name in Indonesian
  }

  // Older: show date (DD/MM/YYYY)
  return format(messageDate, 'dd/MM/yyyy');
}
