// Process liveness only: no credentials, API dependencies, MQTT or inference.
try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || '3000'}/api/healthz`, {
    redirect: 'error', signal: AbortSignal.timeout(3000),
  });
  const body = await response.json();
  if (!response.ok || body.status !== 'ok') process.exitCode = 1;
} catch { process.exitCode = 1; }
