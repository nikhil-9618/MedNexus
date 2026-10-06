export default async () => Response.json({
  message: 'This clinic feature is not connected to the Netlify backend yet.',
}, { status: 501, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
