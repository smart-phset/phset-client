// Subset used by our private Compose raw env files: literal key=value lines,
// no shell evaluation/interpolation/quote stripping, blank lines and # comments.
export function parseRuntimeEnv(text) {
  const values = {};
  for (const [index, line] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const separator = line.indexOf('=');
    const name = line.slice(0, separator).trim();
    if (separator < 1 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || Object.hasOwn(values, name)) {
      throw new Error(`Invalid or duplicate runtime env key at line ${index + 1}`);
    }
    values[name] = line.slice(separator + 1);
  }
  return values;
}
