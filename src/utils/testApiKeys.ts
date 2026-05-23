import { GOOGLE_PLACES_API } from '../services/google';

export type TestResult = { success: boolean; message: string };

/** Test a Google Maps API key using the Geocoding API (supports CORS in browsers). */
export async function testGoogleKey(apiKey: string): Promise<TestResult> {
  if (!apiKey) return { success: false, message: 'No API key entered.' };
  try {
    const res = await fetch(
      `${GOOGLE_PLACES_API}/geocode/json?address=Miami&key=${apiKey}`
    );
    const data = await res.json();
    if (data.status === 'OK') {
      return { success: true, message: 'Connected! Google Maps API key is valid (Geocoding + Places APIs detected).' };
    }
    if (data.status === 'REQUEST_DENIED') {
      return { success: false, message: `Geocoding API not enabled. Enable it in Google Cloud Console. ${data.error_message || ''}` };
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      return { success: false, message: 'Key is hitting rate limits. Check billing in Google Cloud Console.' };
    }
    if (data.status === 'INVALID_REQUEST') {
      return { success: false, message: 'Invalid request. Check that Geocoding API is enabled. ' + (data.error_message || '') };
    }
    return { success: false, message: `Google API error: ${data.status}${data.error_message ? ' — ' + data.error_message : ''}` };
  } catch (err) {
    return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

export async function testLlmKey(keys: { apiKey: string; baseUrl: string; modelId: string }): Promise<TestResult> {
  if (!keys.apiKey) return { success: false, message: 'No API key entered.' };
  if (!keys.baseUrl) return { success: false, message: 'No base URL configured.' };
  try {
    const baseUrl = keys.baseUrl.replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${keys.apiKey}`,
      },
      body: JSON.stringify({
        model: keys.modelId,
        messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
        max_tokens: 10,
      }),
    });
    if (res.ok) return { success: true, message: `Connected! ${keys.modelId} is responding.` };
    const errorText = await res.text().catch(() => '');
    if (res.status === 401) return { success: false, message: 'Invalid API key.' };
    return { success: false, message: `API error (${res.status}): ${errorText.slice(0, 100)}` };
  } catch (err) {
    return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

