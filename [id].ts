type Event = {
  date: string;
  time: string;
  place: string;
  status: string;
};

const EKART_BASE =
  "https://www.ekartlogistics.com/ekartlogistics-web/shipmenttrack/";

function clean(s: string) {
  return s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}

function decodeHtml(s: string) {
  return clean(s);
}

function parseTrackingTable(html: string): Event[] {
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const table of tableMatches) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    if (rows.length < 2) continue;

    const cells = (row: string) =>
      (row.match(/<(?:td|th)\b[^>]*>[\s\S]*?<\/(?:td|th)>/gi) || [])
        .map(decodeHtml);

    const headers = cells(rows[0]).map(x => x.toLowerCase());
    const required = ["date", "time", "place", "status"];
    if (!required.every(x => headers.includes(x))) continue;

    const index = Object.fromEntries(required.map(x => [x, headers.indexOf(x)]));
    const events: Event[] = [];

    for (const row of rows.slice(1)) {
      const c = cells(row);
      if (c.length < 4) continue;
      events.push({
        date: c[index.date] || "",
        time: c[index.time] || "",
        place: c[index.place] || "",
        status: c[index.status] || ""
      });
    }
    if (events.length) return events;
  }
  return [];
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };
}

export const onRequestOptions: PagesFunction = () =>
  new Response(null, { status: 204, headers: corsHeaders() });

export const onRequestGet: PagesFunction = async ({ params }) => {
  const id = String(params.id || "").trim().toUpperCase();

  if (!/^[A-Z0-9_-]{5,50}$/.test(id)) {
    return Response.json({ error: "Invalid tracking ID." }, { status: 400, headers: corsHeaders() });
  }

  const url = EKART_BASE + encodeURIComponent(id);

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9"
      },
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    if (!upstream.ok) {
      return Response.json(
        { error: `Ekart returned HTTP ${upstream.status}.` },
        { status: 502, headers: corsHeaders() }
      );
    }

    const html = await upstream.text();

    if (/No tracking data available for ID/i.test(html)) {
      return Response.json(
        { error: `No tracking data found for ${id}.` },
        { status: 404, headers: corsHeaders() }
      );
    }

    const events = parseTrackingTable(html);

    if (!events.length) {
      return Response.json(
        {
          error:
            "Ekart was reached, but its tracking table could not be parsed. Ekart may have changed the page or blocked this request."
        },
        { status: 502, headers: corsHeaders() }
      );
    }

    const text = clean(html);
    const currentMatch = text.match(/Current Status:\s*(.*?)\s*(?:Shipment Details Received|Tracking Details|Expected Delivery|$)/i);
    const expectedMatch = text.match(/Expected on:\s*(.*?)\s*(?:Track another order|Current Status|Shipment Details Received|$)/i);

    return Response.json({
      trackingId: id,
      currentStatus: currentMatch?.[1]?.trim() || events.at(-1)?.status || "",
      expected: expectedMatch?.[1]?.trim() || "",
      events,
      sourceUrl: url,
      checkedAt: new Date().toISOString()
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Could not reach Ekart from the Cloudflare Function." },
      { status: 502, headers: corsHeaders() }
    );
  }
};