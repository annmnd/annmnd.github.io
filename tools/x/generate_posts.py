import argparse
from datetime import datetime, timedelta, date
from pathlib import Path
import yaml
from dataclasses import dataclass
import csv
import shutil
import json


@dataclass
class DailyPost:
    art_id: str
    art_number: int


@dataclass
class GalleryPost:
    art_id: str


@dataclass
class Schedule:
    date: date
    daily: DailyPost
    gallery: GalleryPost


def parse_args():

    parser = argparse.ArgumentParser()

    group = parser.add_mutually_exclusive_group(required=True)

    group.add_argument(
        "--next-week",
        action="store_true",
        help="Generate posts for the week following the last generated schedule."
    )

    group.add_argument(
        "--from",
        dest="date_from",
        help="Start date (YYYY-MM-DD)"
    )

    parser.add_argument(
        "--to",
        help="End date (YYYY-MM-DD)"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true"
    )

    args = parser.parse_args()

    if args.next_week:
        return args

    if not args.date_from or not args.to:
        parser.error("--from and --to are required.")

    return args


def load_state():

    path = Path(__file__).parent / "state.json"

    if not path.exists():
        raise RuntimeError(
            "state.json not found.\n"
            "Run once with --from and --to."
        )

    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_state(start_date, end_date):

    path = Path(__file__).parent / "state.json"

    state = {
        "version": 1,
        "last_from": start_date.isoformat(),
        "last_to": end_date.isoformat(),
        "generated_at": datetime.now().isoformat(timespec="seconds")
    }

    with open(path, "w", encoding="utf-8") as f:

        json.dump(
            state,
            f,
            indent=2,
            ensure_ascii=False
        )


def load_config():
    config_path = Path(__file__).parent / "config.yaml"

    with open(config_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_archive_list():
    path = Path(__file__).parent / "archive_list.txt"

    result = []

    with open(path, encoding="utf-8") as f:

        for line in f:

            line = line.split("#")[0].strip()

            if line:
                result.append(line)

    return result


def load_templates(config):

    base = Path(__file__).parent

    templates = {}

    for key in ("daily", "gallery"):

        path = base / config["templates"][key]

        with open(path, encoding="utf-8") as f:
            templates[key] = f.read()

    return templates


def render_template(template, art_id, art_number, config):

    url = f'{config["site"]["base_url"]}/?art={art_id}'

    text = template

    text = text.replace("{{ART_ID}}", art_id)
    text = text.replace("{{ART_NUMBER}}", str(art_number))
    text = text.replace("{{URL}}", url)

    return text


def export_posts(config, schedule, templates):

    output_dir = (
        Path(__file__).parent /
        config["paths"]["output"] /
        "posts"
    ).resolve()

    for item in schedule:

        post_dir = output_dir / item.date.strftime("%Y%m%d")
        post_dir.mkdir(parents=True, exist_ok=True)

        daily = render_template(
            templates["daily"],
            item.daily.art_id,
            item.daily.art_number,
            config
        )

        gallery = render_template(
            templates["gallery"],
            item.gallery.art_id,
            0,
            config
        )

        (post_dir / "daily.txt").write_text(
            daily,
            encoding="utf-8"
        )

        (post_dir / "gallery.txt").write_text(
            gallery,
            encoding="utf-8"
        )


def generate_schedule(config, archives, start_date, end_date):

    base_date = datetime.strptime(
        config["daily"]["start_date"],
        "%Y-%m-%d"
    ).date()

    base_art = config["daily"]["start_art"]

    schedule = []

    day = start_date

    archive_index = 0

    while day <= end_date:

        diff = (day - base_date).days

        if diff < 0:
            raise RuntimeError(
                f"{day} is earlier than start_date ({base_date})."
            )

        art_number = base_art + diff

        art_id = f"art{art_number:04}"

        schedule.append(
            Schedule(
                date=day,
                daily=DailyPost(
                    art_id=art_id,
                    art_number=art_number
                ),
                gallery=GalleryPost(
                    art_id=archives[archive_index]
                )
            )
        )

        archive_index += 1

        day += timedelta(days=1)

    return schedule


def print_schedule(schedule):

    print()

    print("=" * 50)
    print("Generate X Posts")
    print("=" * 50)

    for item in schedule:

        print()

        print(item.date)

        print(f"  Daily    : {item.daily.art_id}")
        print(f"  Gallery  : {item.gallery.art_id}")

    print()

    print("=" * 50)
    print(f"Daily   : {len(schedule)}")
    print(f"Gallery : {len(schedule)}")
    print("=" * 50)


def export_schedule_csv(config, schedule):

    output_dir = (
        Path(__file__).parent /
        config["paths"]["output"]
    ).resolve()

    output_dir.mkdir(parents=True, exist_ok=True)

    csv_path = output_dir / "schedule.csv"

    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:

        writer = csv.writer(f)

        writer.writerow([
            "date",
            "time",
            "type",
            "art_id",
            "art_number",
            "text_file",
            "image_file"
        ])

        for item in schedule:

            date_folder = item.date.strftime("%Y%m%d")

            writer.writerow([
                item.date.isoformat(),
                config["schedule"]["daily_time"],
                "daily",
                item.daily.art_id,
                item.daily.art_number,
                f"posts/{date_folder}/daily.txt",
                f"posts/{date_folder}/daily.webp"
            ])

            writer.writerow([
                item.date.isoformat(),
                config["schedule"]["gallery_time"],
                "gallery",
                item.gallery.art_id,
                "",
                f"posts/{date_folder}/gallery.txt",
                f"posts/{date_folder}/gallery.webp"
            ])


def build_schedule_report(schedule, args):

    lines = []

    lines.append("=" * 50)
    lines.append("Generate X Posts")
    lines.append("=" * 50)
    lines.append("")

    if args.next_week:
        mode = "NEXT WEEK"
    elif args.dry_run:
        mode = "DRY RUN"
    else:
        mode = "NORMAL"

    lines.append(f"Mode   : {mode}")
    lines.append(
        f"Period : {schedule[0].date} ～ {schedule[-1].date}"
    )
    lines.append("")

    for item in schedule:

        lines.append("-" * 50)
        lines.append(str(item.date))
        lines.append("")
        lines.append("  Daily")
        lines.append(f"    Art ID : {item.daily.art_id}")
        lines.append(f"    Number : {item.daily.art_number}")
        lines.append("")
        lines.append("  Gallery")
        lines.append(f"    Art ID : {item.gallery.art_id}")
        lines.append("")

    lines.append("=" * 50)
    lines.append("Summary")
    lines.append("")
    lines.append(f"  Daily   : {len(schedule)}")
    lines.append(f"  Gallery : {len(schedule)}")
    lines.append("")
    lines.append("Done.")
    lines.append("=" * 50)

    return "\n".join(lines)


def export_images(config, schedule):

    originals = (
        Path(__file__).parent /
        config["paths"]["originals"]
    ).resolve()

    output = (
        Path(__file__).parent /
        config["paths"]["output"] /
        "posts"
    ).resolve()

    for item in schedule:

        folder = output / item.date.strftime("%Y%m%d")

        daily_src = originals / f"{item.daily.art_id}_01.webp"
        daily_dst = folder / "daily.webp"

        shutil.copy2(daily_src, daily_dst)

        gallery_src = originals / f"{item.gallery.art_id}_01.webp"
        gallery_dst = folder / "gallery.webp"

        shutil.copy2(gallery_src, gallery_dst)


def validate_assets(config, schedule):

    originals = (
        Path(__file__).parent /
        config["paths"]["originals"]
    ).resolve()

    errors = []

    for item in schedule:

        daily = originals / f"{item.daily.art_id}_01.webp"

        if not daily.exists():
            errors.append(str(daily))

        gallery = originals / f"{item.gallery.art_id}_01.webp"

        if not gallery.exists():
            errors.append(str(gallery))

    if errors:

        print()

        print("Missing image files")

        for e in errors:
            print(f"  {e}")

        raise RuntimeError(
            f"{len(errors)} image(s) missing."
        )


def prepare_output(config):

    output = (
        Path(__file__).parent /
        config["paths"]["output"]
    ).resolve()

    if output.exists():
        shutil.rmtree(output)

    output.mkdir(parents=True)


def write_log(config, report):

    output = (
        Path(__file__).parent /
        config["paths"]["output"]
    ).resolve()

    (output / "generate.log").write_text(
        report,
        encoding="utf-8"
    )


def export_manifest(config, schedule):

    output = (
        Path(__file__).parent /
        config["paths"]["output"]
    ).resolve()

    posts = []

    for item in schedule:

        folder = item.date.strftime("%Y%m%d")

        posts.append({
            "date": item.date.isoformat(),
            "time": config["schedule"]["daily_time"],
            "type": "daily",
            "art_id": item.daily.art_id,
            "art_number": item.daily.art_number,
            "text": f"posts/{folder}/daily.txt",
            "image": f"posts/{folder}/daily.webp"
        })

        posts.append({
            "date": item.date.isoformat(),
            "time": config["schedule"]["gallery_time"],
            "type": "gallery",
            "art_id": item.gallery.art_id,
            "art_number": None,
            "text": f"posts/{folder}/gallery.txt",
            "image": f"posts/{folder}/gallery.webp"
        })

    manifest = {
        "version": 1,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "generator": "generate_posts.py",
        "posts": posts
    }

    with open(
        output / "manifest.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            manifest,
            f,
            indent=2,
            ensure_ascii=False
        )


def main():

    args = parse_args()

    config = load_config()

    archives = load_archive_list()

    if args.next_week:

        state = load_state()

        last_to = datetime.strptime(
            state["last_to"],
            "%Y-%m-%d"
        ).date()

        start_date = last_to + timedelta(days=1)
        end_date = start_date + timedelta(days=6)

    else:

        start_date = datetime.strptime(
            args.date_from,
            "%Y-%m-%d"
        ).date()

        end_date = datetime.strptime(
            args.to,
            "%Y-%m-%d"
        ).date()

    if start_date > end_date:
        raise RuntimeError(
            "--from must be earlier than or equal to --to."
        )

    days = (end_date - start_date).days + 1

    if len(archives) < days:

        raise RuntimeError(
            f"archive_list.txt has {len(archives)} entries. "
            f"{days} required."
        )

    schedule = generate_schedule(
        config,
        archives,
        start_date,
        end_date
    )

    report = build_schedule_report(schedule, args)
    print(report)

    templates = load_templates(config)

    if not args.dry_run:
        prepare_output(config)
        validate_assets(config, schedule)
        export_schedule_csv(config, schedule)
        export_manifest(config, schedule)
        export_posts(config, schedule, templates)
        export_images(config, schedule)
        save_state(
            start_date,
            end_date
        )
        write_log(config, report)


if __name__ == "__main__":
    main()