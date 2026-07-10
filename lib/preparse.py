import csv
import json
import os

MOCKUP_DIR = os.path.join(os.getcwd(), "datamockup")
OUTPUT_FILE = os.path.join(os.getcwd(), "lib", "tvtime_data.json")

def parse_csv(filename):
    filepath = os.path.join(MOCKUP_DIR, filename)
    if not os.path.exists(filepath):
        return []
    with open(filepath, mode="r", encoding="utf-8") as f:
        # Some fields might have quotes, so use csv.reader
        reader = csv.reader(f)
        return list(reader)

def main():
    print("Pre-parsing TV Time CSV mockup files...")

    # 1. Parse user.csv
    user_rows = parse_csv("user.csv")
    user_data = {
        "id": "11519429",
        "email": "pietrofranchitti@hotmail.it",
        "username": "Pietrolone",
        "created_at": "2017-02-22 12:54:19"
    }
    if len(user_rows) >= 2:
        headers = user_rows[0]
        values = user_rows[1]
        if "id" in headers and values[headers.index("id")]:
            user_data["id"] = values[headers.index("id")]
        if "name" in headers and values[headers.index("name")]:
            user_data["username"] = values[headers.index("name")]
        if "mail" in headers and values[headers.index("mail")]:
            user_data["email"] = values[headers.index("mail")]
        if "created_at" in headers and values[headers.index("created_at")]:
            user_data["created_at"] = values[headers.index("created_at")]

    # 2. Parse user_tv_show_data.csv
    show_rows = parse_csv("user_tv_show_data.csv")
    tracked_shows = []
    if len(show_rows) >= 2:
        headers = show_rows[0]
        show_name_idx = headers.index("tv_show_name") if "tv_show_name" in headers else -1
        show_id_idx = headers.index("tv_show_id") if "tv_show_id" in headers else -1
        is_followed_idx = headers.index("is_followed") if "is_followed" in headers else -1
        is_favorited_idx = headers.index("is_favorited") if "is_favorited" in headers else -1
        episodes_seen_idx = headers.index("nb_episodes_seen") if "nb_episodes_seen" in headers else -1

        for row in show_rows[1:]:
            if len(row) < len(headers):
                continue
            show_name = row[show_name_idx] if show_name_idx >= 0 else None
            show_id_str = row[show_id_idx] if show_id_idx >= 0 else None
            is_followed = row[is_followed_idx] == "1" if is_followed_idx >= 0 else False
            is_favorited = row[is_favorited_idx] == "1" if is_favorited_idx >= 0 else False
            episodes_seen = int(row[episodes_seen_idx]) if (episodes_seen_idx >= 0 and row[episodes_seen_idx].isdigit()) else 0

            if not show_name or not show_id_str:
                continue

            media_id = int(show_id_str)
            status = "Want to Watch"
            if is_favorited:
                status = "Favorites"
            elif is_followed:
                status = "Currently Watching"
            elif episodes_seen > 0:
                status = "Watched"

            tracked_shows.append({
                "media_id": media_id,
                "media_type": "tv",
                "title": show_name,
                "poster_path": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=400&auto=format&fit=crop",
                "status": status,
                "user_rating": 10 if is_favorited else None,
                "updated_at": "2026-07-10T08:00:00.000Z"
            })

    # 3. Parse user_statistics.csv
    stats_rows = parse_csv("user_statistics.csv")
    stats_data = {
        "timeSpent": 216072,
        "showsFollowedCount": 451
    }
    if len(stats_rows) >= 2:
        headers = stats_rows[0]
        values = stats_rows[1]
        if "time_spent" in headers and values[headers.index("time_spent")]:
            stats_data["timeSpent"] = int(values[headers.index("time_spent")])
        if "nb_shows_followed" in headers and values[headers.index("nb_shows_followed")]:
            stats_data["showsFollowedCount"] = int(values[headers.index("nb_shows_followed")])

    # Export to unified JSON file
    payload = {
        "user": user_data,
        "tracked": tracked_shows,
        "stats": stats_data
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"Successfully generated TV Time JSON data at {OUTPUT_FILE} with {len(tracked_shows)} shows!")

if __name__ == "__main__":
    main()
