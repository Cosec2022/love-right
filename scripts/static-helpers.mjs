export const moduleEntrypoints = (html) => [...html.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
  .map((match) => match[1]);

export function verifyModuleEntrypoint(html) {
  const entries = moduleEntrypoints(html);
  const mainEntries = entries.filter((src) => new URL(src, "https://love-right.invalid/").pathname === "/app/main.js");
  if (mainEntries.length !== 1) throw new Error(`index.html must load exactly one application module; found ${mainEntries.length}.`);
  if (!/^\.\/app\/main\.js(?:\?[^#]*)?$/.test(mainEntries[0])) throw new Error(`Invalid application module path: ${mainEntries[0]}`);
}
