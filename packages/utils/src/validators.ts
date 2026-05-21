export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidSaudiPhone(phone: string): boolean {
  return /^\+9665\d{8}$/.test(phone);
}

export function isValidIqama(id: string): boolean {
  return /^\d{10}$/.test(id);
}

export function isValidCrNumber(cr: string): boolean {
  return /^\d{10}$/.test(cr);
}
