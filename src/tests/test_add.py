from __future__ import annotations #TimeRecord를 문자열 없이 쓰게 해주는 안전장치
from dataclasses import dataclass #스키마 만들기
from datetime import date, datetime, time #시간 파싱/ 계산
import re #정규 표현식 HH:MM 검증에 사용됨
import uuid #ID 자동 발급
from typing import Optinal, Dict, Any #타입 힌트

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$") # date는 "YYYY-MM-DD" 형식이어야 함
_HHMM_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$") #start_at/end_at는 "HH:MM" 형식이어야 함

def _validate_date(value: str) -> None:
    if not _DATE_RE.match(value):
        raise ValueError(f"Invalid date format: {value}. Expected 'YYYY-MM-DD'.")
    
def _validate_hhmm(value: str) -> None:
    if not _HHMM_RE.match(value):
        raise ValueError(f"Invalid time format: {value}. Expected 'HH:MM'.")