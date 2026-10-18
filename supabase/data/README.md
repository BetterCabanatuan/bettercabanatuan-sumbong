# Cabanatuan City boundary data

| File | Contents |
| --- | --- |
| `cabanatuan-city.geojson` | One GeoJSON `Feature`, `MultiPolygon` (1 part, no holes), EPSG:4326. Properties: `name`, `psgc`, `source_name`. |
| `cabanatuan-barangays.geojson` | `FeatureCollection` of 89 features, one per barangay, `MultiPolygon` EPSG:4326. Properties: `name` (official PSA name), `psgc` (10-digit PSGC string), `source_name` (name as it appears in the source). |

Coordinates are longitude/latitude (WGS 84), rounded to 7 decimals. Rings follow RFC 7946 orientation: exteriors counter-clockwise. The files are 66 KB and 279 KB, so the geometry is **not simplified**: it is the source geometry as published.

## Source

**Geometry:** OCHA / HDX, *Philippines - Subnational Administrative Boundaries* (COD-AB, dataset version 03). The data comes from the National Mapping and Resource Information Authority (NAMRIA) and the Philippine Statistics Authority (PSA).

- Dataset page: https://data.humdata.org/dataset/cod-ab-phl
- Resource used: `phl_admin_boundaries.shp.zip` (HTTP Last-Modified 2026-05-28), layers `phl_admin3` for the city and `phl_admin4` for the barangays.
- Feature `valid_on` date in the source: 2025-02-13.
- City record: `adm3_pcode` `PH0304903`, "Cabanatuan City". Barangay records: the 89 `adm4` rows where `adm3_pcode = PH0304903`.

**Codes and official names:** PSA, Philippine Standard Geographic Code (PSGC), *2Q 2026 Publication Datafile* (`PSGC-2Q-2026-Publication-Datafile.xlsx`, sheet `PSGC`). psa.gov.ph serves a Cloudflare challenge to scripts, so the file came from the Internet Archive copy of the official URL `https://psa.gov.ph/system/files/scd/PSGC-2Q-2026-Publication-Datafile.xlsx`, snapshot `20260904120257`, SHA-256 `31892bc2bdde3ea0682562d9412b5bab4d45a0be5e5a5b4f6c9d7714b94bca5d`. The psgc.cloud mirror returns the same 89 codes.

**Retrieved:** 2026-10-18.

## License and attribution

- The HDX COD-AB geometry is licensed **CC BY-IGO 3.0**: https://creativecommons.org/licenses/by/3.0/igo/. You may share and adapt it, including commercially, as long as you give attribution and note that it was changed. Our changes: we extracted one city and its barangays, joined PSA names and codes, rounded coordinates, and reoriented rings. No reprojection was needed because the source is already WGS 84.
- PSGC codes and names are public statistical classifications published by the PSA. Cite the PSA as the source.

**Attribution line to show in the app** (for example in the map footer or the About page):

> Boundaries: NAMRIA & PSA via OCHA/HDX (COD-AB Philippines), CC BY-IGO 3.0. Barangay codes: PSA PSGC.

## Why this source

- **OpenStreetMap:** the city relation exists (relation 17796544, `admin_level=6`, ODbL), but OSM has **no barangay (`admin_level=10`) boundaries** for Cabanatuan. The whole city bounding box holds only one level-10 relation. OSM cannot cover barangays, and mixing it with another source would combine ODbL share-alike data with CC BY-IGO data, so OSM was used only for cross-checking.
- **HDX COD-AB:** complete. It has all 89 barangays, PSGC-based P-codes, a clear CC BY license, and city and barangay layers that share edges exactly.
- **PhilGIS:** no longer maintained, with an unclear license.
- **NAMRIA Geoportal:** no openly licensed bulk download.

## Matching against PSA

- PSA PSGC 2Q 2026 lists **89 barangays** under City of Cabanatuan (`0304903000`).
- HDX has 89 barangay features. **Matched 89 of 89**, with no barangays missing geometry and no extra features. Every `psgc` value is non-null and unique.
- **Method:** we matched by code first. The HDX `adm4_pcode` with the `PH` prefix removed is the 10-digit PSGC (for example `PH0304903002` becomes `0304903002`), and every code matched a PSA row. We then checked the names: lowercase, strip accents, parenthetical text, `Pob.`/`Poblacion` and punctuation, then compare. All 89 agree after this normalization.
- **`name`** is the PSA `Name` column with trailing whitespace trimmed, for example `Barrera District`. PSA records poblacion status in a separate `Status` column, so `(Pob.)` is not part of `name`. `source_name` keeps the HDX label.
- **Raw-string differences.** None of these is a real mismatch:
  - HDX adds `(Pob.)` to 19 barangays that PSA flags `Status = Pob.`: Barrera District, Bernardo District, Bonifacio District, Kapitan Pepe, City Supermarket, Dicarma, Dimasalang, Fatima, General Luna, Isla, Matadero, Melojavilla, Quezon District, Rizdelis, Sanbermicristi, Vijandre District, Zulueta District, Nabao and Padre Burgos.
  - HDX adds the former name in parentheses for 4 barangays: `Aduas Centro (Aduas)`, `Calawagan (Kalawagan)`, `Lourdes (Matungal-tungal)` and `San Juan Pob. (Acofa)`. These old names appear in PSA's `Old names` column.
  - PSA writes `Santo Niño` with ñ. The files are UTF-8.

## Sanity checks (run on the final files)

- **Containment:** every barangay polygon lies 100.000% inside the city polygon. The union of all barangays equals the city polygon (189.899 km²), with 0 km² of overlap between barangays, 0 km² of city left uncovered, and 0 km² of barangay area outside the city. No self-intersections were found.
- **City Hall:** OSM puts Cabanatuan City Hall at **15.47082 N, 120.95195 E** on M. de Leon Avenue (OSM way 116548296). That point is inside the city, in barangay **Hermogenes C. Concepcion, Sr.**. The coordinate 15.4868 N, 120.9670 E (the old downtown/poblacion area, not the current City Hall) is also inside the city, in **San Roque Norte**.
- **Barangay halls:** 60 OSM barangay halls fall inside the city. 54 land in the barangay whose name they carry. Five of the other six are spelling variants (Kalkid/Kalikid Norte, Sumacab Sur/South, Magsaysay Sur/South, D. S./Dionisio S. Garcia, San Roque Melencio/Norte). Only "Ibabao Bana Barangay Hall" lands in the neighbouring Talipapa.
- **Comparison with the OSM city outline:** the two outlines overlap closely (189.25 km² vs 189.90 km², IoU 0.989). Distances from OSM boundary vertices to the HDX boundary are: median 5 m, p90 22 m, p99 about 220 m, max about 460 m.

## Caveats for consumers

- The COD-AB is a humanitarian reference dataset. It is **not a legal or cadastral boundary**: edges can be off by tens of metres, and in places by a few hundred. Reports near the city edge or a barangay edge may be classified wrongly. Consider allowing a tolerance, such as accepting points within about 500 m of the city polygon, or treating out-of-bounds as a warning instead of a hard reject. When choosing a barangay for a point near an edge, use the nearest barangay as a fallback.
- PSGC changes every quarter. To refresh, compare against a newer PSA publication datafile by `psgc` code.
