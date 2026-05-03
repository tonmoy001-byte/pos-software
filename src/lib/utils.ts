export function formatCurrency(amount: number | string | any): string {
  if (amount === null || amount === undefined) return "৳0";
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(num);
}

export function formatDate(date: string | Date | any): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(date: string | Date | any): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(date: string | Date | any): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit'
  });
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}