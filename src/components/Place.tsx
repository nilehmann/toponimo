import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";

import { useDarkTheme } from "../hooks/useTheme";

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

/** Los dos mapas base. Cambiar de proveedor es cambiar estas dos líneas y el crédito: el resto
 *  del componente no sabe de dónde vienen los tiles. Hacen falta los dos porque el juego tiene
 *  tema claro y oscuro, y un mapa claro sobre fondo oscuro encandila. */
const TILES: Record<"light" | "dark", string> = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

const CREDIT =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

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
  const tiles = useRef<L.TileLayer | null>(null);
  const dark = useDarkTheme();

  useEffect(() => {
    const controller = new AbortController();
    setPlace(null);
    setFailed(false);
    fetch(`${import.meta.env.BASE_URL}geo/${geo}.json`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);
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
    tiles.current = L.tileLayer(TILES[dark ? "dark" : "light"], {
      attribution: CREDIT,
      maxZoom: 19,
    }).addTo(m);
    const shape = L.geoJSON(place.geometry, {
      // Las clases ganan sobre los atributos que pone Leaflet, así el contorno sigue al tema.
      style: { className: "fill-ok stroke-ok", weight: 2, opacity: 1, fillOpacity: 0.2 },
    }).addTo(m);
    m.fitBounds(shape.getBounds(), { padding: [22, 22] });
    const [lon, lat] = place.properties.point;
    L.marker([lat, lon], { icon: PIN, keyboard: false, alt: place.properties.name }).addTo(m);
    return () => {
      m.remove();
      tiles.current = null;
    };
    // `dark` queda fuera a propósito, y lo atiende el efecto de abajo: rehacer el mapa entero
    // al cambiar de tema perdería el encuadre que la persona eligió arrastrando.
  }, [place]);

  useEffect(() => {
    tiles.current?.setUrl(TILES[dark ? "dark" : "light"]);
  }, [dark]);

  const pop = place?.properties.pop;
  return (
    <div className="mt-4">
      <div className="overflow-hidden rounded-xl border border-line">
        {failed ? (
          <p className="flex h-72 items-center justify-center bg-btn px-6 text-center text-muted">
            No se pudo cargar el mapa.
          </p>
        ) : (
          <div
            ref={node}
            role="img"
            aria-label={`Mapa de ${name}`}
            className="h-72 w-full bg-btn"
          />
        )}
      </div>

      <h2 className="mt-4 text-3xl leading-tight font-extrabold text-ok">{name}</h2>
      <p className="mt-0.5 text-muted">
        Comuna de {comuna}, {region}.
      </p>

      {place && (
        <dl className="mt-3 flex gap-3">
          {pop !== undefined && (
            <Fact label="Habitantes" value={pop.toLocaleString("es-CL")} />
          )}
          <Fact
            label="Referencia"
            value={`${place.properties.km} km`}
            note={`de ${place.properties.ref}`}
          />
        </dl>
      )}
    </div>
  );
}
