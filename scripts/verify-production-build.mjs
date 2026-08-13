import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const forbidden = [
  ['localhost origin', /(?:localhost|127\.0\.0\.1):\d+/i],
  ['server secret name', /(?:SUPABASE_SERVICE_ROLE_KEY|MARKET_ENGINE_API_KEY|SECRET_KEY)/],
  ['private key material', /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/],
];

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

const findings = [];
for (const path of await files('dist')) {
  if (!/\.(?:html|js|css|json|svg)$/.test(path)) continue;
  const content = await readFile(path, 'utf8');
  for (const [label, pattern] of forbidden) {
    if (pattern.test(content)) findings.push(`${path}: ${label}`);
  }
}
if (findings.length) {
  process.stderr.write(`${findings.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('Production bundle contains no localhost origin or server-only secret identifiers.\n');
