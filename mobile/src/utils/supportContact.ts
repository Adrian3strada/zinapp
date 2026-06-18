/** Formato legible para números MX (10 dígitos). */
export function formatWhatsAppDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^52/, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phone.trim();
}

export function passwordResetWhatsAppMessage(username: string): string {
  return (
    `Hola, olvidé mi contraseña de ZinApp.\n` +
    `Usuario: ${username}\n` +
    '¿Me pueden ayudar a restablecerla?'
  );
}
