import os
import json
import pandas as pd

rows = []

folder = "."

for file in os.listdir(folder):

    if not file.endswith(".geojson"):
        continue

    print("Processing:", file)

    path = os.path.join(folder, file)

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        features = data.get("features", [])

        print("  features:", len(features))

        for ftr in features:

            props = ftr.get("properties") or {}
            geometry = ftr.get("geometry") or {}

            row = dict(props)

            row["geometry_type"] = geometry.get("type")
            row["coordinates"] = str(geometry.get("coordinates"))
            row["source_file"] = file

            rows.append(row)

    except Exception as e:
        print("ERROR in", file, ":", e)

df = pd.DataFrame(rows)

print("TOTAL ROWS:", len(df))

df.to_excel("merged_all_geojson.xlsx", index=False)

print("DONE -> merged_all_geojson.xlsx")
