import type * as maplibregl from "maplibre-gl";
import { CATEGORY_HEX, type Category } from "@/lib/herway";

const ICONS: Record<Category, string> = {
  harassment: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  stalking:
    '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/>',
  sexual_assault:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  other: '<circle cx="12" cy="12" r="4" fill="white"/>',
};

function pinSvg(cat: Category, selected = false) {
  const fill = CATEGORY_HEX[cat];
  const ring = selected ? '<path d="M24 3C13.5 3 6 10.8 6 20.5 6 33 24 53 24 53s18-20 18-32.5C42 10.8 34.5 3 24 3z" fill="none" stroke="#1f3b44" stroke-width="3"/>' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56">
  <path d="M24 3C13.5 3 6 10.8 6 20.5 6 33 24 53 24 53s18-20 18-32.5C42 10.8 34.5 3 24 3z" fill="${fill}" stroke="white" stroke-width="2.5"/>${ring}
  <g transform="translate(14 10.5) scale(0.84)" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[cat]}</g></svg>`;
}

function load(svg: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(48, 56);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

export async function addPinImages(map: maplibregl.Map) {
  const cats = Object.keys(CATEGORY_HEX) as Category[];
  await Promise.all(
    cats.flatMap((c) => [
      load(pinSvg(c)).then((img) => !map.hasImage(`pin-${c}`) && map.addImage(`pin-${c}`, img, { pixelRatio: 2 })),
      load(pinSvg(c, true)).then((img) => !map.hasImage(`pin-${c}-sel`) && map.addImage(`pin-${c}-sel`, img, { pixelRatio: 1.6 })),
    ]),
  );
}

export { pinSvg };
