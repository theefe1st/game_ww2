#!/bin/bash
# Скачивает данные Natural Earth (GeoJSON) в tools/data — нужны только для пересборки карт (build-hexmap.cjs, build-frontmap.cjs)
cd "$(dirname "$0")" && mkdir -p data && cd data
for f in ne_10m_land ne_10m_lakes ne_10m_lakes_europe ne_10m_rivers_lake_centerlines ne_10m_rivers_europe ne_50m_land ne_50m_lakes ne_50m_rivers_lake_centerlines ne_10m_coastline; do
  curl -s -o $f.geojson "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/$f.geojson"
done
echo DL_DONE > dl.done
