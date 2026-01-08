from __future__ import annotations #TimeRecord를 문자열 없이 쓰게 해주는 안전장치
from dataclasses import dataclass #스키마 만들기
from datetime import date, datetime, time #시간 파싱/ 계산
import re #정규 표현식 HH:MM 검증에 사용됨
import uuid #ID 자동 발급
from typing import Optional, Dict, Any #타입 힌트

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$") # date는 "YYYY-MM-DD" 형식이어야 함
_HHMM_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$") #start_at/end_at는 "HH:MM" 형식이어야 함

def _validate_date_str(value: str) -> None:
    if not _DATE_RE.match(value):
        raise ValueError(f"Invalid date format: {value}. Expected 'YYYY-MM-DD'.")
    
def _validate_hhmm_str(value: str) -> None:
    if not _HHMM_RE.match(value):
        raise ValueError(f"Invalid time format: {value}. Expected 'HH:MM'.")
    

def compute_duration_seconds(date_str: str, start_hhmm:str, end_hhmm: str) -> int:
    """
    Compute duration in seconds for a single-day record.
    Rules (MVP):
    - smae day only
    - end must be >= start
    - time format is HH:MM
    """
    """
    1. 입력 검증: 이상한 날짜/ 시간은 초기에 컷
    2. 문자열 "09:00"을 int로 쪼갠다
    3. 계산은 datetime으로 한다 (문자열 계산 금지)
    4. end <start는 MVP에서 에러(야간 넘어가능 기능은 다음에)
    """
    _validate_date_str(date_str)
    _validate_hhmm_str(start_hhmm)
    _validate_hhmm_str(end_hhmm)

    y, m ,d = map(int, date_str.split("-"))
    start_h, start_m = map(int, start_hhmm.split(":"))
    end_h, end_m = map(int, end_hhmm.split(":"))

    day = date(y,m,d)

    start_dt = datetime.combine(day, time(start_h, start_m))
    end_dt = datetime.combine(day, time(end_h, end_m))

    if end_dt < start_dt:
        raise ValueError("end_hhmm must be greater than or equal to start_hhmm.")   
    return int((end_dt - start_dt).total_seconds())


@dataclass(frozen=True) # frozen=True: 한번 만든 기록은 불변으로 실수로 값 못바꾸게함
class TimeRecord:
    """
    One row in your DAILY TIME TRACKER table.
    Excel mapping:
      - TASK      -> task_title
      - START     -> start_at (HH:MM)
      - END       -> end_at (HH:MM)
      - DURATION  -> duration_seconds (computed)
      - NOTE      -> notes
      - DATE      -> date (YYYY-MM-DD) from header
      Datetime으로 저장 안하는건, Excel 호환성과 Json에서 저장할 때 손해임
    """
    id: str
    date: str
    task_title: str
    start_at: str
    end_at: str
    duration_seconds: int
    notes: Optional[str] = None

    @staticmethod
    def create(
        *,
        date: str,
        task_title: str,
        start_at: str,
        end_at: str,
        notes: Optional[str] = None,
        record_id: Optional[str] = None,
    ) -> "TimeRecord":
        _validate_date_str(date)
        _validate_hhmm_str(start_at)
        _validate_hhmm_str(end_at)

        if not task_title or not task_title.strip():
            raise ValueError("task_title cannot be empty.")
        
        dur = compute_duration_seconds(date, start_at, end_at)
        rid = record_id or str(uuid.uuid4())

        return TimeRecord(
            id=rid,
            date=date,
            task_title=task_title.strip(),
            start_at=start_at,
            end_at=end_at,
            duration_seconds=dur,
            notes=(notes.strip() if isinstance(notes, str) and notes.strip() else None),
        )
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "date": self.date,
            "task_title": self.task_title,
            "start_at": self.start_at,
            "end_at": self.end_at,
            "duration_seconds": self.duration_seconds,
            "notes": self.notes,
        }
    @staticmethod
    def from_dict(d: Dict[str,Any]) -> "TimeRecord":
        required = ["id", "date", "task_title", "start_at", "end_at", "duration_seconds"]
        for k in required:
            if k not in d:
                raise ValueError(f"Missing required field '{k}' in dict.")
        _validate_date_str(str(d["date"]))
        _validate_hhmm_str(str(d["start_at"]))
        _validate_hhmm_str(str(d["end_at"]))

        # duration should match start/end (data integrity)
        expected = compute_duration_seconds(str(d["date"]), str(d["start_at"]), str(d["end_at"]))
        actual = int(d["duration_seconds"])
        if actual != expected:
            raise ValueError(f"duration_seconds mismatch (expected {expected}, got {actual})")

        return TimeRecord(
            id=str(d["id"]),
            date=str(d["date"]),
            task_title=str(d["task_title"]),
            start_at=str(d["start_at"]),
            end_at=str(d["end_at"]),
            duration_seconds=actual,
            notes=(str(d["notes"]) if d.get("notes") not in (None, "") else None),
        )