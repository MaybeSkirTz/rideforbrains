export const sportLabel = (sport: string) =>
  ({ velo: 'Vélo', course: 'Course', marche: 'Marche' })[sport] || 'Activité';
export function activityPricing(activities: { price: number }[]) {
  const prices = activities.map((a) => a.price).filter(Number.isFinite);
  return {
    amount: prices.length ? Math.min(...prices) : null,
    maximum: prices.length ? Math.max(...prices) : null,
    startingAt: new Set(prices).size > 1,
  };
}
export function activityPriceLabel(activities: { price: number }[]) {
  const p = activityPricing(activities),
    format = (n: number) =>
      new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n / 100);
  return p.amount === null
    ? ''
    : p.amount === 0
      ? p.startingAt
        ? 'Gratuit à ' + format(p.maximum!)
        : 'Gratuit'
      : (p.startingAt ? 'Dès ' : '') + format(p.amount);
}
export function participantComplete(p: any, activity: any) {
  if (
    !activity ||
    !p.firstName.trim() ||
    !p.lastName.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) ||
    p.phone.trim().length < 7 ||
    !p.emergencyName.trim() ||
    p.emergencyPhone.trim().length < 7 ||
    typeof p.adult !== 'boolean' ||
    !p.conditions ||
    !p.authority
  )
    return false;
  if (activity.sport === 'velo' && !p.adult) return false;
  if (!p.adult && p.guardianStatus !== 'approved') return false;
  return activity.fields.every((f: any) => {
    if (f.showWhen && p.answers[f.showWhen.field] !== f.showWhen.equals) return true;
    const value = p.answers[f.id];
    if (!f.required && (value === undefined || value === '')) return true;
    return f.type === 'checkbox'
      ? !f.required || value === true
      : f.type === 'select'
        ? f.options?.includes(value)
        : typeof value === 'string' && (!f.required || !!value.trim());
  });
}
