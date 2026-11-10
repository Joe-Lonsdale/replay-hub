import "server-only";

export function steamLoginUrl(app: string): string {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${app}/api/auth/steam/callback`,
    "openid.realm": app,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `https://steamcommunity.com/openid/login?${params}`;
}

export async function verifyAssertion(requestUrl: string, app: string): Promise<string> {
  const url = new URL(requestUrl);
  const returnTo = url.searchParams.get("openid.return_to");
  if (returnTo !== `${app}/api/auth/steam/callback`) {
    throw new Error("Steam return address did not match this app");
  }
  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (key.startsWith("openid.")) params.set(key, value);
  }
  params.set("openid.mode", "check_authentication");
  const response = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const text = await response.text();
  if (!/^is_valid\s*:\s*true\s*$/im.test(text)) throw new Error("Steam rejected the login");
  const claimed = url.searchParams.get("openid.claimed_id") ?? "";
  const id = claimed.split("/").pop() ?? "";
  if (!/^\d{17}$/.test(id)) throw new Error("Steam did not return an account id");
  return id;
}

export async function steamProfile(steamId: string): Promise<{
  name: string;
  avatar: string | null;
  url: string | null;
}> {
  const fallback = {
    name: `Steam ${steamId.slice(-4)}`,
    avatar: null,
    url: `https://steamcommunity.com/profiles/${steamId}`,
  };
  const key = process.env.STEAM_API_KEY;
  if (!key) return fallback;
  const endpoint = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/");
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.set("steamids", steamId);
  const response = await fetch(endpoint);
  if (!response.ok) return fallback;
  const body = (await response.json()) as {
    response?: { players?: { personaname?: string; avatarfull?: string; profileurl?: string }[] };
  };
  const player = body.response?.players?.[0];
  return {
    name: player?.personaname || fallback.name,
    avatar: player?.avatarfull ?? null,
    url: player?.profileurl ?? fallback.url,
  };
}
