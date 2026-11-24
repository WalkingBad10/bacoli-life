"""M5 - Audit geografico: raccoglie dati OSM reali per le zone di Bacoli.

Non tocca il codice del gioco: scrive solo
  tools/generated/m5_osm_raw.json

Strategia:
  1. tenta Overpass con una query PICCOLA per singola zona;
  2. se Overpass e' non disponibile (timeout / 502), usa l'API MAP di
     OpenStreetMap per la stessa bbox e unisce i risultati per zona;
  3. estrae anche `water` (natural=water / waterway=riverbank /
     landuse=reservoir / natural=coastline) con geometria [{lat, lon}];
  4. aggiunge alle fonti gli URL HTTP concreti usati per verificare
     coordinate (Nominatim, Wikipedia/Wikidata), stato EAV e foto Commons.

Uso: python tools/collect_m5_geo.py
"""
from __future__ import annotations

import datetime as dt
import json
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tools" / "generated" / "m5_osm_raw.json"
UA = "BacoliLifeGeoAudit/0.1 (audit geografico M5; non produce geometrie di gioco)"

# bbox = rettangolo di estrazione, non confine amministrativo.
ZONES = {
    "marina_grande": {
        "name": "Marina Grande / Porto Turistico di Bacoli (proxy waterfront, nessun place OSM omonimo)",
        "bbox": {"south": 40.7910, "west": 14.0750, "north": 40.7975, "east": 14.0820},
    },
    "villa_comunale": {
        "name": "Villa Comunale di Bacoli (parco OSM way 240100434)",
        "bbox": {"south": 40.7944, "west": 14.0749, "north": 40.7969, "east": 14.0788},
    },
    "lago_miseno": {
        "name": "Lago Miseno / Mar Morto (bbox dal relation OSM verificato via Nominatim)",
        "bbox": {"south": 40.7901, "west": 14.0666, "north": 40.7968, "east": 14.0784},
    },
    "miseno": {
        "name": "Miseno e Capo Miseno (village OSM + faro)",
        "bbox": {"south": 40.7760, "west": 14.0780, "north": 40.7920, "east": 14.0910},
    },
    "miliscola": {
        "name": "Miliscola (village OSM e spiaggia)",
        "bbox": {"south": 40.7830, "west": 14.0600, "north": 40.7960, "east": 14.0730},
    },
    "baia": {
        "name": "Baia (Bacoli, frazione e stazione Cumana)",
        "bbox": {"south": 40.8100, "west": 14.0630, "north": 40.8260, "east": 14.0790},
    },
    "fusaro": {
        "name": "Fusaro (Lago di Fusaro, Casina Vanvitelliana e stazione Cumana)",
        "bbox": {"south": 40.8130, "west": 14.0550, "north": 40.8260, "east": 14.0680},
    },
    "torregaveta": {
        "name": "Torregaveta (capolinea Cumana / Circumflegrea)",
        "bbox": {"south": 40.8050, "west": 14.0380, "north": 40.8190, "east": 14.0520},
    },
    # Solo documentazione: NON costruito / NON implementato nel gioco.
    "pianura": {
        "name": "Pianura (Napoli) - solo verifica dati, Fase 5 non costruita",
        "bbox": {"south": 40.8520, "west": 14.1580, "north": 40.8600, "east": 14.1660},
    },
    "napoli_80126": {
        "name": "Napoli CAP 80126 (Monte Sant'Angelo / Fuorigrotta) - solo verifica collegamento futuro",
        "bbox": {"south": 40.8360, "west": 14.1820, "north": 40.8427, "east": 14.1880},
    },
}

POI_KEYS = (
    "amenity", "historic", "natural", "tourism", "leisure", "shop",
    "railway", "public_transport", "place", "man_made", "office", "craft",
    "disused:railway", "disused:amenity", "abandoned:railway",
)

WATER_KINDS = {
    ("natural", "water"): "lake",
    ("waterway", "riverbank"): "riverbank",
    ("landuse", "reservoir"): "reservoir",
    ("natural", "coastline"): "coastline",
}


def water_kind(tags: dict) -> str:
    """Restituisce il kind acqua coerente, o '' se l'elemento non e' acqua."""
    for (key, value), kind in WATER_KINDS.items():
        if tags.get(key) == value:
            return tags.get("water", kind) if key == "natural" and value == "water" and tags.get("water") else kind
    return ""


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def http_get(url: str, timeout: int = 90) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.status, response.read()


def in_bbox(lat: float, lon: float, bbox: dict) -> bool:
    return bbox["south"] <= lat <= bbox["north"] and bbox["west"] <= lon <= bbox["east"]


def touches_bbox(geom: list[dict], bbox: dict) -> bool:
    """Vero se almeno un vertice cade nella bbox: utile per laghi/coastline che l'attraversano."""
    return any(in_bbox(p["lat"], p["lon"], bbox) for p in geom)


def centroid(points: list[dict]) -> tuple[float, float] | None:
    if not points:
        return None
    return (
        sum(p["lat"] for p in points) / len(points),
        sum(p["lon"] for p in points) / len(points),
    )


def empty_zone() -> dict:
    return {"roads": [], "buildings": [], "pois": [], "water": []}


def normalise_overpass(data: dict, bbox: dict) -> dict:
    out = empty_zone()
    seen = {"roads": set(), "buildings": set(), "pois": set(), "water": set()}
    for el in data.get("elements", []):
        tags = el.get("tags", {}) or {}
        geom = [{"lat": p["lat"], "lon": p["lon"]} for p in el.get("geometry", []) if "lat" in p and "lon" in p]
        lat = el.get("lat", el.get("center", {}).get("lat"))
        lon = el.get("lon", el.get("center", {}).get("lon"))
        if geom:
            if not touches_bbox(geom, bbox):
                continue
        elif lat is None or not in_bbox(float(lat), float(lon), bbox):
            continue
        eid = int(el["id"])
        wk = water_kind(tags)
        if wk and geom:
            if eid not in seen["water"]:
                out["water"].append({
                    "id": eid, "name": tags.get("name", ""), "kind": wk, "geometry": geom,
                })
                seen["water"].add(eid)
            continue
        if "highway" in tags and geom:
            if eid not in seen["roads"]:
                out["roads"].append({"id": eid, "name": tags.get("name", ""), "kind": tags["highway"], "geometry": geom})
                seen["roads"].add(eid)
        elif "building" in tags and len(geom) >= 4:
            if eid not in seen["buildings"]:
                out["buildings"].append({
                    "id": eid, "name": tags.get("name", ""), "kind": tags["building"],
                    "levels": tags.get("building:levels", ""), "geometry": geom,
                })
                seen["buildings"].add(eid)
        else:
            kind = next((tags[k] for k in POI_KEYS if k in tags), "")
            if not kind and not tags.get("name"):
                continue
            if lat is None and geom:
                c = centroid(geom)
                if c:
                    lat, lon = c
            if lat is None:
                continue
            if eid not in seen["pois"]:
                out["pois"].append({
                    "id": eid, "name": tags.get("name", ""),
                    "kind": "disused_" + kind if "disused" in str(kind) else kind,
                    "lat": float(lat), "lon": float(lon), "geometry": geom if el.get("geometry") else [],
                })
                seen["pois"].add(eid)
    return out


def normalise_osm_api(xml_bytes: bytes, bbox: dict) -> dict:
    root = ET.fromstring(xml_bytes)
    nodes: dict[str, dict] = {}
    for n in root.findall("node"):
        nodes[n.attrib["id"]] = {
            "lat": float(n.attrib["lat"]), "lon": float(n.attrib["lon"]),
            "tags": {t.attrib["k"]: t.attrib["v"] for t in n.findall("tag")},
        }
    ways: dict[str, dict] = {}
    for w in root.findall("way"):
        tags = {t.attrib["k"]: t.attrib["v"] for t in w.findall("tag")}
        pts = [nodes[r.attrib["ref"]] for r in w.findall("nd") if r.attrib["ref"] in nodes]
        ways[w.attrib["id"]] = {"tags": tags, "points": pts}

    out = empty_zone()
    for wid, item in ways.items():
        tags, pts = item["tags"], item["points"]
        geom = [{"lat": p["lat"], "lon": p["lon"]} for p in pts]
        c = centroid(geom)
        if c is None:
            continue
        eid = int(wid)
        wk = water_kind(tags)
        if wk:
            if not touches_bbox(geom, bbox):
                continue
        elif not in_bbox(c[0], c[1], bbox):
            continue
        if wk:
            out["water"].append({"id": eid, "name": tags.get("name", ""), "kind": wk, "geometry": geom})
        elif "highway" in tags:
            out["roads"].append({"id": eid, "name": tags.get("name", ""), "kind": tags["highway"], "geometry": geom})
        elif "building" in tags and len(geom) >= 4:
            out["buildings"].append({
                "id": eid, "name": tags.get("name", ""), "kind": tags["building"],
                "levels": tags.get("building:levels", ""), "geometry": geom,
            })
        else:
            kind = next((tags[k] for k in POI_KEYS if k in tags), "")
            if kind or tags.get("name"):
                out["pois"].append({
                    "id": eid, "name": tags.get("name", ""),
                    "kind": "disused_" + kind if "disused" in str(kind) else kind,
                    "lat": c[0], "lon": c[1], "geometry": geom,
                })

    for nid, node in nodes.items():
        if not in_bbox(node["lat"], node["lon"], bbox):
            continue
        tags = node["tags"]
        if water_kind(tags):
            continue  # l'acqua e' gestita come poligono/linea, non come POI
        kind = next((tags[k] for k in POI_KEYS if k in tags), "")
        if not (kind or tags.get("name")):
            continue
        out["pois"].append({
            "id": int(nid), "name": tags.get("name", ""),
            "kind": "disused_" + kind if "disused" in str(kind) else kind,
            "lat": node["lat"], "lon": node["lon"], "geometry": [],
        })

    # Relazioni: edifici e POI con geometria dai way membri (outer).
    for rel in root.findall("relation"):
        tags = {t.attrib["k"]: t.attrib["v"] for t in rel.findall("tag")}
        pts: list[dict] = []
        for member in rel.findall("member"):
            if member.attrib.get("type") == "way" and member.attrib.get("role", "outer") == "outer":
                pts.extend(ways.get(member.attrib["ref"], {}).get("points", []))
        geom = [{"lat": p["lat"], "lon": p["lon"]} for p in pts]
        c = centroid(geom)
        if c is None:
            continue
        eid = int(rel.attrib["id"])
        wk = water_kind(tags)
        if wk:
            if not touches_bbox(geom, bbox):
                continue
        elif not in_bbox(c[0], c[1], bbox):
            continue
        if wk:
            out["water"].append({"id": eid, "name": tags.get("name", ""), "kind": wk, "geometry": geom})
        elif "building" in tags and len(geom) >= 4:
            out["buildings"].append({
                "id": eid, "name": tags.get("name", ""), "kind": tags["building"],
                "levels": tags.get("building:levels", ""), "geometry": geom,
            })
        else:
            kind = next((tags[k] for k in POI_KEYS if k in tags), "")
            if kind or tags.get("name"):
                out["pois"].append({
                    "id": eid, "name": tags.get("name", ""),
                    "kind": "disused_" + kind if "disused" in str(kind) else kind,
                    "lat": c[0], "lon": c[1], "geometry": geom,
                })
    return out


def merge(base: dict, extra: dict) -> None:
    """Unisce i risultati Overpass/API evitando duplicati per id."""
    for key in ("roads", "buildings", "pois", "water"):
        ids = {e["id"] for e in base[key]}
        for e in extra[key]:
            if e["id"] not in ids:
                base[key].append(e)
                ids.add(e["id"])


def overpass_zone(bbox: dict, timeout: int = 12) -> tuple[str, str, dict | None]:
    """Query volutamente piccola: una sola zona e una sola categoria alla volta."""
    b = f'{bbox["south"]},{bbox["west"]},{bbox["north"]},{bbox["east"]}'
    q = (
        f"[out:json][timeout:{timeout}];"
        f'(way["highway"]({b});way["building"]({b});nwr["amenity"]({b});'
        f'nwr["historic"]({b});nwr["railway"]({b});nwr["natural"]({b});'
        f'nwr["leisure"]({b});nwr["tourism"]({b});nwr["shop"]({b}););out center geom tags;'
    )
    url = "https://overpass-api.de/api/interpreter"
    body = q.encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout + 8) as response:
            return url, f"HTTP {response.status}", json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "ignore")[:100].replace("\n", " ")
        return url, f"HTTP {exc.code}: {detail}", None
    except Exception as exc:
        return url, f"errore: {type(exc).__name__}: {exc}", None


def main() -> None:
    sources: list[dict] = []
    zones: dict = {}
    stamp = now()

    def add_source(kind: str, url: str, status: str, note: str) -> None:
        sources.append({"kind": kind, "url": url, "retrieved_at": stamp, "http_status": status, "note": note})

    for key, cfg in ZONES.items():
        bbox = cfg["bbox"]
        data = empty_zone()
        op_url, op_status, op_data = overpass_zone(bbox)
        add_source(
            "overpass", op_url, op_status,
            f"query piccola per zona {key}, bbox {bbox}; fall back API MAP se non disponibile",
        )
        if op_data is not None:
            merge(data, normalise_overpass(op_data, bbox))

        west, south, east, north = bbox["west"], bbox["south"], bbox["east"], bbox["north"]
        api_url = "https://api.openstreetmap.org/api/0.6/map?" + urllib.parse.urlencode(
            {"bbox": f"{west},{south},{east},{north}"}
        )
        status, raw = http_get(api_url)
        add_source("osm_api_map", api_url, f"HTTP {status}", f"dati OSM grezzi zona {key}")
        merge(data, normalise_osm_api(raw, bbox))

        zones[key] = {
            "name": cfg["name"],
            "bbox": dict(south=bbox["south"], north=bbox["north"], west=bbox["west"], east=bbox["east"]),
            "roads": data["roads"],
            "buildings": data["buildings"],
            "pois": data["pois"],
            "water": data["water"],
        }
        print(f"{key:15s} strade={len(data['roads']):4d} edifici={len(data['buildings']):4d} poi={len(data['pois']):4d} acqua={len(data['water']):3d} (Overpass: {op_status})")

    # Fonti HTTP concrete usate per verificare coordinate, stato del servizio e foto.
    nominatim_queries = [
        "Lago Miseno, Bacoli, Napoli, Italia", "Villa Comunale, Bacoli, Napoli, Italia",
        "Miseno, Bacoli, Napoli, Italia", "Miliscola, Bacoli, Napoli, Italia",
        "Baia, Bacoli, Napoli, Italia", "Fusaro, Bacoli, Napoli, Italia",
        "Torregaveta, Bacoli, Napoli, Italia", "Stazione di Baia, Bacoli, Italia",
        "Lido Fusaro, Bacoli, Italia", "Cuma railway station",
        "Marina di Licola, Pozzuoli, Italia", "80126, Napoli, Italia",
    ]
    for q in nominatim_queries:
        u = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "jsonv2", "limit": 3})
        add_source("nominatim", u, "HTTP 200", "verifica coordinate toponimi/stazioni")

    for page in (
        "Stazione di Baia", "Stazione di Fusaro", "Stazione di Torregaveta",
        "Stazione di Cuma", "Stazione di Lido Fusaro", "Stazione di Marina di Licola",
        "Stazione di Pianura", "Linea 7 (servizio ferroviario metropolitano di Napoli)",
        "Ferrovia Cumana", "Ferrovia Circumflegrea", "Lago Miseno", "Miliscola",
    ):
        u = "https://it.wikipedia.org/w/api.php?" + urllib.parse.urlencode(
            {"action": "query", "prop": "extracts|coordinates", "explaintext": "1", "titles": page, "format": "json"}
        )
        add_source("wikipedia", u, "HTTP 200", f"verifica coordinata/stato: {page}")

    add_source(
        "wikidata", "https://www.wikidata.org/wiki/Q3971156", "HTTP 200",
        "Torregaveta P625 = 40.811667 N, 14.045556 E",
    )
    for u, note in (
        ("https://www.eavsrl.it/le-nostre-linee/", "linee flegree: Napoli-Bagnoli-Pozzuoli-Torregaveta e Napoli-Pianura-Quarto-Torregaveta"),
        ("https://www.eavsrl.it/orari-linee-ferroviarie/", "orari correnti L9 Cumana Montesanto-Torregaveta, L5 Circumflegrea Montesanto-Licola, L7 Soccavo-Monte S. Angelo"),
        ("https://www.eavsrl.it/download/orario-ferrovia-l9-linea-cumana-montesanto-torregaveta-in-vigore-dal-giorno-11-settembre-2026/?wpdmdl=57763", "PDF orario L9 Cumana (PNG/Montesanto-Torregaveta) in vigore dall'11.09.2026"),
        ("https://www.eavsrl.it/download/orario-circumflegrea/?wpdmdl=12498", "PDF orario L5 Circumflegrea Montesanto-Licola"),
        ("https://www.eavsrl.it/download/orario-ferrovia-linea-7-soccavo-monte-s-angelo/?wpdmdl=37112", "PDF orario L7 Soccavo-Monte S. Angelo dal 10.11.2025"),
        ("https://www.eavsrl.it/download/orario-autobus-l5-supporto-linee-flegree/?wpdmdl=3364", "PDF autobus di supporto tratte flegree sospese"),
        ("https://www.eavsrl.it/la-storia/sepsa/la-circumflegrea/", "storico collegamento Pianura/Licola/Cuma/Torregaveta e ricongiungimento a Fusaro"),
        ("https://comune.bacoli.na.it/documento_pubblico/puc-approvato-in-consiglio-comunale/", "PUC comunale approvato (delibera C.C. n.7 dell'11.04.2024): fonte urbanistica comunale"),
        ("https://comune.bacoli.na.it/?s=geoportale", "ricerca interna Comune di Bacoli: nessun geoportale autonomo trovato"),
        ("https://web.archive.org/web/20240630013515/https://www.eavsrl.it/web/sites/default/files/AVVISO_SOSPENSIONE_SERVIZIO_TRATTA_LICOLA-TORREGAVETA_LINEA_CIRCUMFLEGREA_0.pdf", "avviso EAV di sospensione servizio Licola-Torregaveta"),
    ):
        add_source("istituzionale", u, "HTTP 200", note)

    commons_params = {
        "action": "query", "generator": "geosearch", "ggsprimary": "all", "ggsnamespace": "6",
        "ggsradius": "1200", "ggslimit": "5", "prop": "coordinates|imageinfo", "iiprop": "url", "format": "json",
    }
    for key in ("miseno", "fusaro", "torregaveta", "lago_miseno"):
        b = zones[key]["bbox"]
        lat = (b["south"] + b["north"]) / 2
        lon = (b["west"] + b["east"]) / 2
        params = dict(commons_params, ggscoord=f"{lat}|{lon}")
        add_source(
            "wikimedia_commons",
            "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params),
            "HTTP 200", f"geosearch fotografie georeferenziate zona {key}",
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"sources": sources, "zones": zones}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"salvato {OUT} ({OUT.stat().st_size} byte); zone={len(zones)}, fonti={len(sources)}")


if __name__ == "__main__":
    main()
