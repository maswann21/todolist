from __future__ import annotations

import argparse
from pathlib import Path
from typing import Optional, List

from timetracker.models import TimeRecord
from timetracker.storage import append_record, load_records, export_date, filter_by_date

def _seconds_to_hhmm(seconds: int) -> str:
    # 표시용 변환 (저장 데이터 변경 아님)
    h = seconds // 3600
    m = (seconds % 3600) // 60
    return f"{h:02d}:{m:02d}"

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="timetracker", description="Daily Time Tracker (JSON MVP)")
    sub = parser.add_subparsers(dest="command", required=True)

    # add
    p_add = sub.add_parser("add", help="Add a time record")
    p_add.add_argument("--date", required=True, help="YYYY-MM-DD")
    p_add.add_argument("--title", required=True, help="Task title")
    p_add.add_argument("--start", required=True, help="HH:MM (24h)")
    p_add.add_argument("--end", required=True, help="HH:MM (24h)")
    p_add.add_argument("--notes", default=None, help="Optional notes")

    # list
    p_list =sub.add_parser("list", help="List records")
    p_list.add_argument("--date", default=None, help="YYYY-MM-DD (optional)")
 # export
    p_exp = sub.add_parser("export", help="Export records for a date to JSON")
    p_exp.add_argument("--date", required=True, help="YYYY-MM-DD")
    p_exp.add_argument("--out", required=True, help="Output JSON path (e.g., out.json)")

    return parser

def cmd_add(args: argparse.Namespace) -> int:
    record = TimeRecord.create(
        date=args.date,
        task_title=args.title,
        start_at=args.start,
        end_at=args.end,
        notes=args.notes,
    )
    append_record(record)
    print(f"Added 1 record (id={record.id})")
    return 0

def cmd_list(args: argparse.Namespace) -> int:
    records = load_records()
    if args.date:
        records = filter_by_date(records, args.date)
    
    if not records:
        if args.date:
            print(f"No records found for date {args.date}.")
        else:
            print("No records found.")  
        return 0

    total = 0
    for r in records:
        total += r.duration_seconds
        print(f"- [{r.id}] {r.date} {r.task_title} {r.start_at}-{r.end_at} "
              f"({_seconds_to_hhmm(r.duration_seconds)})"
              f"{' Notes: ' + r.notes if r.notes else ''}")
    print(f"Total time: {_seconds_to_hhmm(total)} seconds")
    return 0

def cmd_export(args: argparse.Namespace) -> int:
    out_path = Path(args.out)
    export_date(args.date, out_path)
    print(f"Exported records for date {args.date} to {out_path}")
    return 0

def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "add":
            return cmd_add(args)
        if args.command == "list":
            return cmd_list(args)
        if args.command == "export":
            return cmd_export(args)
        parser.error("Unknown command")  # should never happen
        return 2
    except ValueError as e:
        # models/storage validation errors
        print(f"Error: {e}")
        return 2
    except OSError as e:
        # file IO errors
        print(f"File error: {e}")
        return 3


if __name__ == "__main__":
    raise SystemExit(main())