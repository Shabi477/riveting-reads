/**
 * Consistent date formatting utilities to prevent SSR hydration mismatches
 */

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  
  // Use consistent formatting that works the same on server and client
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();
  
  return `${month}/${day}/${year}`;
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  
  return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
}

export function formatDateRelative(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) {
    return 'Today';
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else {
    return formatDate(d);
  }
}