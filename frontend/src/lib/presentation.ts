export function formatDate(value?: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  // A calendar date has no timezone; avoid moving it to the previous day in UTC-5.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
  }).format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function excerpt(text: string, length = 180) {
  if (!text) {
    return "Sin contenido disponible.";
  }

  return text.length > length ? `${text.slice(0, length).trim()}...` : text;
}

export function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
