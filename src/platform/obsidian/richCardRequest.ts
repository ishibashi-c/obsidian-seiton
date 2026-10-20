import { type RequestUrlResponse, requestUrl } from "obsidian";
import { isRichCardDomainDisabled } from "../../shared/richCard";

const MAX_REDIRECTS = 4;

/** Native requestUrl cannot disable automatic redirects. With a deny list,
 * browser fetch rejects all redirects before following them and fails closed on CORS.
 */
export async function requestRichCardUrl(
  url: string,
  disabledDomains: () => string[],
  headers: Record<string, string> = {}
): Promise<RequestUrlResponse> {
  let current = url;
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const domains = disabledDomains();
    if (
      !/^https?:$/.test(new URL(current).protocol) ||
      isRichCardDomainDisabled(current, domains)
    ) {
      throw new Error("Rich card domain is disabled");
    }
    if (domains.some((domain) => domain.trim())) {
      const response = await fetch(current, {
        credentials: "omit",
        headers: { Accept: headers.Accept ?? "*/*" },
        method: "GET",
        mode: "cors",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
      const arrayBuffer = await response.arrayBuffer();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        responseHeaders[name] = value;
      });
      return {
        arrayBuffer,
        headers: responseHeaders,
        json: null,
        status: response.status,
        text: new TextDecoder().decode(arrayBuffer),
      };
    }
    const response = await requestUrl({
      headers,
      method: "GET",
      throw: false,
      url: current,
    });
    if (response.status < 300 || response.status >= 400) {
      return response;
    }
    const key = Object.keys(response.headers).find(
      (name) => name.toLowerCase() === "location"
    );
    if (!key) {
      throw new Error("Rich card redirect has no location");
    }
    current = new URL(response.headers[key], current).toString();
  }
  throw new Error("Too many rich card redirects");
}
