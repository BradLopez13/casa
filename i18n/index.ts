import es from './es.json';

export type MessageKey = keyof typeof es;

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return es[key].replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = vars?.[name];
    return value === undefined ? placeholder : String(value);
  });
}
