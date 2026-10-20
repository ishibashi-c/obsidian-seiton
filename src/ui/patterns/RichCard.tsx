/** @jsxImportSource react */

import { useEffect, useState, useSyncExternalStore } from "react";
import type { RichCardGateway } from "../../platform/ports";
import { type Lang, t } from "../../shared/i18n";
import { type RichCardMetadata, safeRichCardHref } from "../../shared/richCard";
import { extractMainDomain } from "../../shared/sanitize";

function extractDominantColor(image: HTMLImageElement): string | null {
  try {
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const bins = new Map<
      number,
      {
        red: number;
        green: number;
        blue: number;
        count: number;
        saturation: number;
      }
    >();
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const lightness = (maximum + minimum) / 2;
      if (alpha < 125 || lightness > 242 || lightness < 14) {
        continue;
      }
      const key = ((red >> 5) << 10) | ((green >> 5) << 5) | (blue >> 5);
      const bin = bins.get(key) ?? {
        blue: 0,
        count: 0,
        green: 0,
        red: 0,
        saturation: 0,
      };
      bin.red += red;
      bin.green += green;
      bin.blue += blue;
      bin.count += 1;
      bin.saturation += maximum - minimum;
      bins.set(key, bin);
    }
    let winner: {
      red: number;
      green: number;
      blue: number;
      count: number;
      saturation: number;
    } | null = null;
    for (const bin of bins.values()) {
      if (
        !winner ||
        bin.count * 0.7 + bin.saturation / 255 >
          winner.count * 0.7 + winner.saturation / 255
      ) {
        winner = bin;
      }
    }
    return winner
      ? `rgb(${Math.round(winner.red / winner.count)} ${Math.round(winner.green / winner.count)} ${Math.round(winner.blue / winner.count)})`
      : null;
  } catch {
    return null;
  }
}

const subscribeNever = (): (() => void) => () => undefined;
const zeroSnapshot = (): number => 0;

/** React version of the note preview. The store remains the backend boundary. */
export function ReactRichCard({
  url,
  store,
  lang,
}: {
  url: string;
  store: RichCardGateway;
  lang: Lang;
}) {
  const policyRevision = useSyncExternalStore(
    store.subscribe ?? subscribeNever,
    store.getSnapshot ?? zeroSnapshot
  );
  const [card, setCard] = useState<RichCardMetadata | null>(null);
  const [layout, setLayout] = useState<"large" | "compact" | "text">("large");
  const [imageFailed, setImageFailed] = useState(false);
  const [tint, setTint] = useState<string | null>(null);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const allowed = store.allows(url);

  useEffect(() => {
    void policyRevision;
    let active = true;
    setCard(null);
    setLayout("large");
    setImageFailed(false);
    setFaviconFailed(false);
    if (!allowed) {
      return () => {
        active = false;
      };
    }
    void store
      .fetch(url)
      .then((value) => {
        if (active) {
          setLayout(value.imageUrl ? "large" : "text");
          setCard(value);
        }
      })
      .catch(() => {
        // 外部サイトの拒否・一時障害でも、保存したURLを再発見できるカードは残す。
        // 成功時は通常の取得メタデータ、失敗時はURL由来の最小カードを表示する。
        if (active) {
          setLayout("text");
          setCard({
            canonicalUrl: null,
            description: null,
            domain: extractMainDomain(url) ?? url,
            iconUrl: null,
            imageUrl: null,
            siteName: null,
            title: extractMainDomain(url) ?? url,
            url,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [allowed, store, url, policyRevision]);

  if (!allowed) {
    return null;
  }
  if (!card) {
    return (
      <div
        aria-label={t(lang, "richCard.loading")}
        className="seiton-rich-card-skeleton"
        role="status"
      >
        <span>{t(lang, "richCard.loading")}</span>
      </div>
    );
  }

  const visibleCard = store.sanitize?.(card) ?? card;
  const imageUrl = imageFailed ? null : visibleCard.imageUrl;
  const imageWidth = card.imageWidth ?? 0;
  const imageHeight = card.imageHeight ?? 0;
  const portrait = imageHeight > imageWidth * 1.1;
  const resolvedLayout = imageUrl ? layout : "text";
  const fallbackFavicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(card.domain)}&sz=64`;
  const faviconUrl =
    visibleCard.iconUrl ??
    ((store.allowsRemoteAssets?.() ?? true) && store.allows(fallbackFavicon)
      ? fallbackFavicon
      : null);
  const cardTint = tint ?? card.tint ?? null;
  const href = safeRichCardHref(card.canonicalUrl, card.url);

  return (
    <a
      className={`seiton-rich-card layout-${resolvedLayout}`}
      href={href}
      onClick={(event) => event.stopPropagation()}
      rel="noopener noreferrer"
      style={
        cardTint
          ? ({ "--seiton-card-tint": cardTint } as React.CSSProperties)
          : undefined
      }
      target="_blank"
    >
      {Boolean(imageUrl) && (
        <span
          className={`seiton-rich-card-media ${portrait ? "is-portrait" : ""}`}
        >
          <img
            alt=""
            height={360}
            loading="lazy"
            onError={() => {
              setImageFailed(true);
              setLayout("text");
            }}
            onLoad={(event) => {
              const image = event.currentTarget;
              const width = image.naturalWidth;
              const height = image.naturalHeight;
              const iconLike = Math.max(width, height) <= 256;
              setLayout(width < 320 || iconLike ? "compact" : "large");
              setTint(extractDominantColor(image));
            }}
            src={imageUrl ?? undefined}
            width={640}
          />
          <span className="seiton-rich-card-tint" />
        </span>
      )}
      <span className="seiton-rich-card-copy">
        <strong>{card.title || card.domain}</strong>
        {resolvedLayout !== "text" && Boolean(card.description) && (
          <span className="seiton-rich-card-description">
            {card.description}
          </span>
        )}
        <span className="seiton-rich-card-domain">
          {!faviconFailed && Boolean(faviconUrl) && (
            <img
              alt=""
              height={14}
              loading="lazy"
              onError={() => setFaviconFailed(true)}
              src={faviconUrl ?? undefined}
              width={14}
            />
          )}
          {(faviconFailed || !faviconUrl) && (
            <span
              aria-hidden="true"
              className="seiton-rich-card-favicon-fallback"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  fill="none"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="M3.5 12h17M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            </span>
          )}
          <span>{card.domain}</span>
        </span>
      </span>
    </a>
  );
}
