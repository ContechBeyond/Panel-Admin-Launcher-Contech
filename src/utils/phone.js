// Clave de deduplicacion de telefono: normaliza a solo digitos y toma los ultimos 10.
// Asi "+525523456789" y "5523456789" (mismo numero sin lada +52) colapsan a la misma clave.
// El nombre no importa: dos contactos con este mismo key son el mismo numero => duplicado.
export const phoneKey = (raw) => String(raw || '').replace(/\D/g, '').slice(-10)

// True si `number` ya existe (por key de 10 digitos) dentro de `contacts`.
export const isDuplicateNumber = (number, contacts) => {
  const k = phoneKey(number)
  if (!k) return false
  return (contacts || []).some((c) => phoneKey(c.number) === k)
}
