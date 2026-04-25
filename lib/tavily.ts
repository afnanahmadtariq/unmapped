// UNMAPPED — thin Tavily client for live job listings.
// Fails soft: if no API key or upstream error, returns [] so the UI degrades gracefully.

export interface TavilyHit {
  title: string;
  url: string;
  snippet: string;
}

export async function tavilySearch(query: string, max = 4): Promise<TavilyHit[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: max,
        search_depth: "basic",
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: Array<{ title: string; url: string; content?: string }> };
    return (json.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content ?? "").slice(0, 180),
    }));
  } catch {
    return [];
  }
}
