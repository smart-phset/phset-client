import { pathToFileURL } from 'node:url';

/** Fail closed for container startup. Error messages contain names, never values. */
export function validateProductionEnv(env) {
  const errors = [];
  const required = name => { if (!env[name]?.trim()) errors.push(`${name} is required`); };
  const httpsUrl = name => {
    try {
      const url = new URL(env[name]);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
    } catch { errors.push(`${name} must be an HTTPS URL without credentials/query/fragment`); }
  };
  for (const name of ['AUTH_USER', 'AUTH_PASSWORD', 'AUTH_SECRET', 'SMARTPHSET_IOT_API_KEY', 'SMARTPHSET_DEVICE_ID']) required(name);
  if ((env.AUTH_SECRET?.length || 0) < 32) errors.push('AUTH_SECRET must contain at least 32 characters');
  if ((env.AUTH_PASSWORD?.length || 0) < 12) errors.push('AUTH_PASSWORD must contain at least 12 characters');
  if (env.AUTH_USER === 'guest') errors.push('AUTH_USER must not use the reserved guest identity');
  for (const name of ['AUTH_PASSWORD', 'AUTH_SECRET', 'SMARTPHSET_IOT_API_KEY', 'SMARTPHSET_AI_RELAY_TOKEN', 'API_KEY']) {
    if (/YOUR_|REPLACE|CHANGE_ME/i.test(env[name] || '')) errors.push(`${name} still contains a placeholder`);
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.SMARTPHSET_DEVICE_ID || '')) errors.push('SMARTPHSET_DEVICE_ID is invalid');
  httpsUrl('SMARTPHSET_API_BASE_URL');
  for (const name of ['ALLOW_GUEST', 'SMARTPHSET_AI_LIVE_ENABLED', 'SMARTPHSET_AI_UPLOAD_ENABLED']) {
    if (!['true', 'false'].includes(env[name])) errors.push(`${name} must explicitly be true or false`);
  }
  if (env.SMARTPHSET_AI_LIVE_ENABLED === 'true') {
    httpsUrl('SMARTPHSET_AI_LIVE_BASE_URL');
    required('SMARTPHSET_AI_RELAY_TOKEN');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(env.SMARTPHSET_AI_CAMERA_ID || '')) errors.push('SMARTPHSET_AI_CAMERA_ID is invalid');
  }
  if (env.SMARTPHSET_AI_UPLOAD_ENABLED === 'true') {
    httpsUrl('BACKEND_URL');
    required('API_KEY');
    if (env.BACKEND_MODE !== 'bridge') errors.push('BACKEND_MODE must be bridge for the supported production photo service');
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = validateProductionEnv(process.env);
  if (errors.length) {
    console.error('Production configuration rejected:\n' + errors.map(message => `- ${message}`).join('\n'));
    process.exitCode = 1;
  }
}
