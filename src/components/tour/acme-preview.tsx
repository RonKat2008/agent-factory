import { LABEL } from "@/components/ui-tokens";

const W = 360;
const H = 220;
const SCALE = 0.5;

/** Live miniature of the fake Acme site. `refreshKey` forces a reload after each action. */
export function AcmePreview({ refreshKey, broken }: { refreshKey: number; broken: boolean | null }) {
  return (
    <figure className="w-full max-w-[360px] shrink-0">
      <div className="relative overflow-hidden rounded-[3px] border border-stone-300 bg-white" style={{ width: "100%", maxWidth: W, height: H }}>
        <iframe
          key={refreshKey}
          src={`/demo/acme?t=${refreshKey}`}
          title="Live preview of the Acme website"
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
          style={{ width: W / SCALE, height: H / SCALE, transform: `scale(${SCALE})` }}
        />
      </div>
      <figcaption className={`mt-1.5 flex items-center justify-between ${LABEL}`}>
        <span>acme.example · live</span>
        <span className="normal-case tracking-normal">
          nav link:{" "}
          <span className={broken ? "font-semibold text-red-600" : "font-semibold text-stone-800"}>
            {broken === null ? "…" : broken ? "What's new" : "Changelog"}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}
