import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";

import { COPY } from "../copy";

/** Lo que escribe `build_geo.py` en data/processed/geo/{id}.json. Es GeoJSON para que Leaflet lo
 *  dibuje sin traducción, con los datos de la ficha colgando de `properties`. */
interface Feature {
  properties: {
    name: string;
    comuna: string;
    region: string;
    /** Falta en pueblos y aldeas: esas tablas del censo no traen habitantes. */
    pop?: number;
    ref: string;
    km: number;
    /** [lon, lat], el orden de GeoJSON. Leaflet los quiere al revés. */
    point: [number, number];
  };
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

/** El mapa base. Cambiar de proveedor es cambiar esta línea y el crédito: el resto del
 *  componente no sabe de dónde vienen los tiles.
 *
 *  Es el estilo estándar de OpenStreetMap, sin clave y sin cuenta. Hay uno solo, así que el mapa
 *  se ve igual con los dos temas, y así queda a propósito: teñirlo por CSS para que siga
 *  al tema oscuro es lo que hay que hacer con un estilo solo, y se decidió que no. El proveedor
 *  anterior era CARTO, que desde agosto de 2026 marca con agua los tiles pedidos sin clave. */
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** El pin va como `divIcon` y no como icono de imagen para no arrastrar los PNG de Leaflet, que
 *  con un empaquetador terminan apuntando a una ruta que no existe. */
const PIN = L.divIcon({
  className: "",
  iconSize: [26, 34],
  iconAnchor: [13, 34],
  html:
    '<svg viewBox="0 0 26 34" width="26" height="34" aria-hidden="true">' +
    '<path d="M13 33C4 21 1 17 1 12a12 12 0 0 1 24 0c0 5-3 9-12 21Z" ' +
    'fill="var(--color-ok)" stroke="#fff" stroke-width="2.4"/>' +
    '<circle cx="13" cy="12" r="4.5" fill="#fff"/></svg>',
});

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex-1 rounded-lg border border-line bg-btn px-3 py-2">
      <dt className="text-xs font-bold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-lg font-extrabold">
        {value}
        {note && <span className="ml-1 text-sm font-semibold text-muted">{note}</span>}
      </dd>
    </div>
  );
}

interface PlaceProps {
  /** El archivo de `geo/`, sin extensión. Viene en el letrero revelado. */
  geo: string;
  name: string;
  comuna: string;
  region: string;
}

/** La pantalla del lugar: el mapa con su contorno y su pin, y debajo la ficha.
 *
 *  Ocupa el lugar del letrero al revelar un nombre real: el letrero ya cumplió su función y lo
 *  que queda por contestar es dónde queda y qué tamaño tiene. Si el mapa no carga, la ficha se
 *  muestra igual —el nombre y la comuna son el resultado de la ronda, y no dependen de la red. */
export function Place({ geo, name, comuna, region }: PlaceProps) {
  const [place, setPlace] = useState<Feature | null>(null);
  const [failed, setFailed] = useState(false);
  const node = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPlace(null);
    setFailed(false);
    fetch(`${import.meta.env.BASE_URL}geo/${geo}.json`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(COPY.errors.http(res.status));
        return res.json() as Promise<Feature>;
      })
      .then(setPlace)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [geo]);

  useEffect(() => {
    if (!place || !node.current) return;
    // Sin rueda: el mapa vive dentro de una página que se desplaza, y si capturara la rueda
    // bajar la pantalla haría zoom. Quedan el arrastre, el pellizco y los botones.
    const m = L.map(node.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer(TILES, { attribution: CREDIT, maxZoom: 19 }).addTo(m);
    const shape = L.geoJSON(place.geometry, {
      // Las clases ganan sobre los atributos que pone Leaflet, así el contorno sigue al tema.
      style: { className: "fill-ok stroke-ok", weight: 2, opacity: 1, fillOpacity: 0.2 },
    }).addTo(m);
    m.fitBounds(shape.getBounds(), { padding: [22, 22] });
    const [lon, lat] = place.properties.point;
    L.marker([lat, lon], { icon: PIN, keyboard: false, alt: place.properties.name }).addTo(m);
    return () => {
      m.remove();
    };
  }, [place]);

  const pop = place?.properties.pop;
  return (
    <div className="mt-4">
      <div className="overflow-hidden rounded-xl border border-line">
        {failed ? (
          <p className="flex h-72 items-center justify-center bg-btn px-6 text-center text-muted">
            {COPY.reveal.mapFailed}
          </p>
        ) : (
          <div
            ref={node}
            role="img"
            aria-label={COPY.reveal.map(name)}
            className="h-72 w-full bg-btn"
          />
        )}
      </div>

      <h2 className="mt-4 text-3xl leading-tight font-extrabold text-ok">{name}</h2>
      <p className="mt-0.5 text-muted">{COPY.reveal.where(comuna, region)}</p>

      {place && (
        <dl className="mt-3 flex gap-3">
          {pop !== undefined && (
            <Fact label={COPY.reveal.population} value={pop.toLocaleString("es-CL")} />
          )}
          <Fact
            label={COPY.reveal.reference}
            value={COPY.reveal.km(place.properties.km)}
            note={COPY.reveal.from(place.properties.ref)}
          />
        </dl>
      )}
    </div>
  );
}
