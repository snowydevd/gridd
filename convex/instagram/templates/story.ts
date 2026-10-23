import type { Doc } from "../../_generated/dataModel";
import { KIND_LABELS } from "../../lib/eventKinds";
import { type El, div, h } from "./h";
import { fitSize, kicker, richText, wordmark } from "./parts";
import { C, F, PAD, SITE } from "./theme";

// Historia de Instagram (9:16) para compartir un evento desde la app.
export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

const TZ = "America/Montevideo";
const dayFmt = new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });

export type StoryData = {
  kind: string;
  title: string;
  day: string;
  hours: string;
  place: string;
  link: string;
  /** Portada como data URL, o `null` si el evento no tiene. */
  cover: string | null;
};

type StoryEvent = Pick<Doc<"events">, "slug" | "title" | "kind" | "placeName" | "startsAt" | "endsAt" | "noEndTime">;

/** Los textos de la historia, con la fecha en hora de Uruguay (el server corre en UTC). */
export function storyFromEvent(event: StoryEvent, cover: string | null): StoryData {
  const day = dayFmt.format(event.startsAt).replace(/,/g, "");
  const start = timeFmt.format(event.startsAt);
  return {
    kind: KIND_LABELS[event.kind],
    title: event.title,
    day: day.charAt(0).toUpperCase() + day.slice(1),
    hours: event.noEndTime ? `${start} hs` : `${start} – ${timeFmt.format(event.endsAt)} hs`,
    place: event.placeName,
    link: `${SITE}/e/${event.slug}`,
    cover,
  };
}

const COVER_HEIGHT = 720;

export function story(data: StoryData): El {
  const contentWidth = STORY_WIDTH - PAD * 2;
  // Sin portada sobra lugar: el título va más grande y el bloque se centra en el alto.
  const size = data.cover
    ? fitSize(data.title, [[104, 24], [88, 40], [76, 60]], 64)
    : fitSize(data.title, [[140, 24], [116, 40], [100, 60]], 88);
  return div(
    {
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      backgroundColor: C.bg,
      flexDirection: "column",
      padding: PAD,
      paddingTop: 120,
      paddingBottom: 140,
      boxSizing: "border-box",
      fontFamily: F.body,
      color: C.text,
      gap: 56,
    },
    wordmark(64),
    div(
      { flexDirection: "column", gap: 56, flexGrow: 1, justifyContent: data.cover ? "flex-start" : "center" },
      data.cover &&
        h("img", {
          src: data.cover,
          width: contentWidth,
          height: COVER_HEIGHT,
          style: { borderRadius: 40, objectFit: "cover" },
        }),
      div(
        { flexDirection: "column", gap: 32 },
        kicker(data.kind),
        richText(data.title, size),
      ),
      div(
        { flexDirection: "column", gap: 14, borderLeft: `6px solid ${C.accent}`, paddingLeft: 32 },
        h("span", { style: { fontSize: 46, fontWeight: 700 } }, data.day),
        h("span", { style: { fontSize: 40, fontWeight: 500, color: C.muted } }, data.hours),
        h("span", { style: { fontSize: 40, fontWeight: 500, color: C.muted } }, data.place),
      ),
    ),
    div(
      { flexDirection: "column", gap: 12 },
      h("span", { style: { fontSize: 32, fontWeight: 500, color: C.muted } }, "Anotate en"),
      h("span", { style: { fontSize: 40, fontWeight: 700, color: C.accent } }, data.link),
    ),
  );
}
