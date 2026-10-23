export function ms(value: number | undefined): string {
  return value === undefined ? '–' : `${Math.round(value)}`;
}

export function megabytes(value: number | undefined): string {
  return value === undefined ? '–' : `${(value / 1_048_576).toFixed(0)}`;
}

export function percent(rate: number | undefined): string {
  return rate === undefined ? '–' : `${Math.round(rate * 100)} %`;
}

export function clock(at: number): string {
  const time = new Date(at);
  const millis = String(time.getMilliseconds()).padStart(3, '0');
  return `${time.toLocaleTimeString('fr-FR')}.${millis}`;
}
