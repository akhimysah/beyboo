/* Only public city centres are used; the device location never enters this route. */
const cities = new Map(Object.entries({
  paris: [48.86, 2.35], casablanca: [33.57, -7.59], alger: [36.75, 3.06],
  dakar: [14.72, -17.45], london: [51.51, -0.13], istanbul: [41.01, 28.98],
  rio: [-22.91, -43.17], sydney: [-33.87, 151.21]
}));
const snapshots = new Map();
const pending = new Map();
const json = (data, status, cache = 'no-store') => Response.json(data, {status, headers: {'Cache-Control': cache}});
/* MET Norway requires an identifiable client: the contact comes from the deployment, not from the source. */
const userAgent = env => 'BEYBOO/1.0 (+' + (env?.SITE_URL || 'https://github.com/akhimysah/osiris') + (env?.CONTACT_EMAIL ? '; ' + env.CONTACT_EMAIL : '') + ')';
async function load(city, fetcher, env) {
  const [lat, lon] = cities.get(city);
  const response = await fetcher('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat='+lat+'&lon='+lon, {
    headers: {'User-Agent': userAgent(env), Accept: 'application/json'},
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw Error('unavailable');
  const {properties} = await response.json();
  const now = Date.now();
  const hour = properties?.timeseries?.find(slot => {
    const time = Date.parse(slot.time);
    return time > now - 3600000 && time < now + 3600000;
  });
  const temperature = hour?.data?.instant?.details?.air_temperature;
  if (!Number.isFinite(temperature)) throw Error('missing_forecast');
  const expiry = Date.parse(response.headers.get('Expires'));
  const result = {data: {city, time: hour.time, temperature: Math.round(temperature), symbol: hour.data.next_1_hours?.summary?.symbol_code || ''}, expires: Number.isFinite(expiry) && expiry > now ? expiry : now + 600000};
  snapshots.set(city, result);
  return result;
}
export async function weatherRequest(request, fetcher = fetch, env = {}) {
  if (request.method !== 'GET') return json({error:'method'}, 405);
  const city = new URL(request.url).searchParams.get('city');
  if (!cities.has(city)) return json({error:'unknown_city'}, 400);
  try {
    let forecast = snapshots.get(city);
    if (!forecast || forecast.expires <= Date.now()) {
      if (!pending.has(city)) pending.set(city, load(city, fetcher, env).finally(() => pending.delete(city)));
      forecast = await pending.get(city);
    }
    const ttl = Math.max(0, Math.floor((forecast.expires - Date.now()) / 1000));
    return json(forecast.data, 200, 'public, max-age='+ttl);
  } catch {
    const stale = snapshots.get(city);
    if (stale && stale.expires > Date.now() - 6 * 3600000) return json({...stale.data, stale: true}, 200, 'public, max-age=300');
    return json({error:'forecast_unavailable'}, 503);
  }
}
