export type TestResult = { success: boolean; message: string };

export async function testYelpKey(apiKey: string): Promise<TestResult> {
  try {
    const res = await fetch(
      'https://api.yelp.com/v3/businesses/search?term=test&location=test&limit=1',
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (res.ok) return { success: true, message: 'Connected! Yelp API key is valid.' };
    if (res.status === 401) return { success: false, message: 'Invalid API key. Check your Yelp API key.' };
    return { success: false, message: `Yelp API error (${res.status}).` };
  } catch (err) {
    return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

export async function testGoogleKey(apiKey: string): Promise<TestResult> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=0,0&radius=1&key=${apiKey}`
    );
    const data = await res.json();
    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return { success: true, message: 'Connected! Google Maps API key is valid.' };
    }
    if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
      return { success: false, message: `Invalid key or Places API not enabled. ${data.error_message || ''}` };
    }
    return { success: false, message: `Google API error: ${data.status}` };
  } catch (err) {
    return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

export async function testFirecrawlKey(apiKey: string): Promise<TestResult> {
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url: 'https://example.com', formats: ['markdown'] }),
    });
    if (res.ok) return { success: true, message: 'Connected! Firecrawl API key is valid.' };
    if (res.status === 401 || res.status === 403) {
      return { success: false, message: 'Invalid API key or insufficient permissions.' };
    }
    return { success: false, message: `Firecrawl API error (${res.status}).` };
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
