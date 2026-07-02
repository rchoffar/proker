export function formatAmount(val: number): string {
  return `${Math.abs(val).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

export function formatDateParts(iso?: string): { day: string; month: string } {
  if (!iso) return { day: '', month: '' };
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString('fr-FR', { day: '2-digit' }),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase(),
  };
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return '';
  if (startDate && endDate && startDate !== endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      return `${start.getDate()} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    return `${formatDateShort(startDate)} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  const single = startDate ?? endDate!;
  return new Date(single).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateRangeShort(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return '';
  if (!endDate || startDate === endDate) {
    const { day, month } = formatDateParts(startDate ?? endDate);
    return `${day} ${month}`;
  }
  if (!startDate) {
    const { day, month } = formatDateParts(endDate);
    return `${day} ${month}`;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startParts = formatDateParts(startDate);
  const endParts = formatDateParts(endDate);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${startParts.day} – ${endParts.day} ${endParts.month}`;
  }
  return `${startParts.day} ${startParts.month} – ${endParts.day} ${endParts.month}`;
}

export function isFestivalOngoing(startDate?: string, endDate?: string, todayIso?: string): boolean {
  if (!startDate) return false;
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  const end = endDate ?? startDate;
  return startDate <= today && today <= end;
}
