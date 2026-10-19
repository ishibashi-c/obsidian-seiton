import { requestUrl } from "obsidian";

export interface AddressSearchCandidate {
  address: string;
  latitude: number;
  longitude: number;
}

interface GsiAddressSearchFeature {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: {
    title?: unknown;
  };
}

function finiteCoordinate(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

export function parseAddressSearchResults(
  value: unknown
): AddressSearchCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const candidates: AddressSearchCandidate[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const feature = entry as GsiAddressSearchFeature;
    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      continue;
    }
    const longitude = finiteCoordinate(coordinates[0], -180, 180);
    const latitude = finiteCoordinate(coordinates[1], -90, 90);
    const address =
      typeof feature.properties?.title === "string"
        ? feature.properties.title.trim()
        : "";
    if (longitude === null || latitude === null || !address) {
      continue;
    }
    const key = `${address}\u0000${longitude}\u0000${latitude}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push({ address, latitude, longitude });
  }
  return candidates;
}

export async function searchAddressCandidates(
  addressRaw: string
): Promise<AddressSearchCandidate[]> {
  const address = addressRaw.trim();
  if (!address) {
    throw new Error("住所を入力してください");
  }
  const parameters = new URLSearchParams({ q: address });
  const response = await requestUrl({
    method: "GET",
    url: `https://msearch.gsi.go.jp/address-search/AddressSearch?${parameters.toString()}`,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error("住所の検索に失敗しました");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text) as unknown;
  } catch (cause) {
    const error = new Error("住所検索の応答を解釈できませんでした");
    Object.assign(error, { cause });
    throw error;
  }
  return parseAddressSearchResults(parsed);
}
