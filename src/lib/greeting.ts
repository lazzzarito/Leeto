/** Saludo según la hora local del dispositivo. */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Saludo listo para el header, con el nombre calibrado si existe. */
export function greetingForName(name?: string, hour = new Date().getHours()): string {
  const first = name?.trim().split(/\s+/)[0];
  if (!first) return greetingForHour(hour);
  const display = first.charAt(0).toUpperCase() + first.slice(1);
  return `${greetingForHour(hour)}, ${display}`;
}
