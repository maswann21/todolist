# Daily Time Tracker + Todolist Web App - Design Spec

## Overview

Excel "Time Tracker" 형식을 웹 앱으로 구현한다. 캘린더에서 날짜를 클릭하면 일별 체크리스트 + 타임테이블 페이지가 열리고, 데이터는 클라우드 PostgreSQL에 저장한다. 대시보드에서 분석을 제공한다.

## Architecture

```
브라우저 (static HTML/CSS/JS)
        │ fetch (JSON)
FastAPI REST API
        │ SQLAlchemy + asyncpg
Neon PostgreSQL (클라우드)
```

- **백엔드**: FastAPI (REST API only)
- **프론트엔드**: 정적 HTML/CSS/JS (FastAPI가 서빙)
- **DB**: Neon PostgreSQL (클라우드, 회사/집 노트북 공유)
- **차트**: Chart.js

## Pages

| 경로 | 설명 |
|------|------|
| `/` | 캘린더 뷰 (월간 달력, 메인 화면) |
| `/day?date=YYYY-MM-DD` | 일별 상세 (체크리스트 + 타임테이블 + 메모) |
| `/dashboard` | 분석 대시보드 |

## Database Schema

### categories

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | |
| name | VARCHAR | '업무', '공부', '운동', '수면', '생활', '여가' |
| color | VARCHAR | hex color (e.g. '#3B82F6') |

초기 데이터 (seed):

| name | color |
|------|-------|
| 업무 | #3B82F6 (파랑) |
| 공부 | #22C55E (초록) |
| 운동 | #F97316 (주황) |
| 수면 | #6366F1 (남색) |
| 생활 | #9CA3AF (회색) |
| 여가 | #EAB308 (노랑) |

### daily_pages

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | |
| date | DATE, UNIQUE | 2026-03-21 |
| d_day_label | VARCHAR, nullable | "D-30" |
| comment | TEXT, nullable | 상단 코멘트 |
| memo | TEXT, nullable | 하단 메모 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

- 날짜 첫 접근 시 자동 생성

### tasks

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | |
| daily_page_id | FK -> daily_pages.id | |
| category_id | FK -> categories.id | |
| title | VARCHAR | 작업 이름 |
| priority | INTEGER | 순서/우선순위 |
| status | VARCHAR | 'done'(✔) / 'failed'(✖) / 'carry'(▲) / null(미정) |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### time_blocks

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | |
| task_id | FK -> tasks.id | |
| start_at | TIME | 09:00 |
| end_at | TIME | 12:00 |
| created_at | TIMESTAMP | |

- 10분 단위로 스냅 (e.g. 9:00, 9:10, 9:20...)
- 색상은 task -> category -> color로 결정
- TOTAL TIME = SUM(end_at - start_at) for all time_blocks in a day

## UI Layouts

### Calendar View (메인 페이지 `/`)

```
┌─────────────────────────────────────────────┐
│  ◀  2026년 3월  ▶              [Dashboard]  │
├─────┬─────┬─────┬─────┬─────┬─────┬─────┤
│ 일  │ 월  │ 화  │ 수  │ 목  │ 금  │ 토  │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│     │  2  │  3  │  4  │  5  │  6  │  7  │
│     │ 3/5 │ 5/5 │     │ 4/6 │ 6/6 │ 1/3 │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ ... │     │     │     │     │     │     │
```

각 셀: 날짜 + 완료율(✔ 수 / 전체). 클릭 시 일별 상세로 이동.

### Daily Detail View (일별 상세 `/day?date=`)

```
┌─────────────────────────────────────────────────────┐
│  ◀ 2026 / 03 / 21 (토) ▶          D-DAY: D-30      │
├─────────────────────────────────────────────────────┤
│  COMMENT: [____________________________]            │
├─────────────────────────────────────────────────────┤
│  TOTAL TIME: 08:30                                  │
├───────────────────────────┬─────────────────────────┤
│  CHECK LIST (priority)    │  TIMETABLE              │
│                     상태  │  (10분 단위, 5AM~4AM)   │
│  [색] 1. 알고리즘 공부 ✔ │  ██████████             │
│  [색] 2. 회의 준비     ▲ │        ████              │
│  [색] 3. 운동          ✖ │                          │
│  [+ 할 일 추가]          │                          │
├───────────────────────────┴─────────────────────────┤
│  MEMO:                                              │
│  [_______________________________________________]  │
└─────────────────────────────────────────────────────┘
```

- **체크리스트**: 할 일 추가, 상태 클릭으로 ✔/✖/▲ 순환, 드래그로 순서 변경
- **타임테이블**: 드래그로 시간 블록 색칠 (10분 단위 스냅), 색상은 카테고리 색
- **시간 텍스트 입력도 가능**: 시작/종료 시간 직접 입력
- **COMMENT, MEMO**: 인라인 편집, 포커스 벗어나면 자동 저장
- **TOTAL TIME**: time_blocks 합산 자동 계산
- **◀ ▶**: 이전/다음 날짜 이동

### Dashboard (`/dashboard`)

```
┌─────────────────────────────────────────────────────┐
│  Dashboard               기간: [이번 주 ▼]          │
├─────────────────────────┬───────────────────────────┤
│  일별 총 작업시간 추이   │  카테고리별 시간 비중      │
│  (바 차트)               │  (도넛 차트)              │
│  카테고리 색상으로 스택  │                           │
├─────────────────────────┴───────────────────────────┤
│  할 일 완료율 (✔/✖/▲ 비율, 스택 바 차트)            │
│  ✔ 완료 ████████████████████ 68%                    │
│  ▲ 이월 ██████ 20%                                  │
│  ✖ 미완 ████ 12%                                    │
└─────────────────────────────────────────────────────┘
```

- 기간 필터: 이번 주 / 이번 달 / 커스텀 범위
- Chart.js로 구현

## Project Structure (fresh start)

```
todolist/
├── main.py                  -- FastAPI 앱 진입점
├── requirements.txt
├── .env                     -- Neon DB 접속 URL
├── .gitignore
├── db/
│   ├── database.py          -- DB 연결 설정
│   ├── models.py            -- SQLAlchemy 모델
│   └── seed.py              -- 카테고리 초기 데이터
├── api/
│   ├── daily_pages.py       -- 일별 페이지 라우터
│   ├── tasks.py             -- 할 일 라우터
│   ├── time_blocks.py       -- 타임블록 라우터
│   └── analytics.py         -- 분석 라우터
├── static/
│   ├── index.html           -- 캘린더 (메인)
│   ├── day.html             -- 일별 상세
│   ├── dashboard.html       -- 대시보드
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── calendar.js
│       └── day.js
│       └── dashboard.js
```

기존 코드 전부 초기화 후 이 구조로 새로 시작.

## Tech Stack

- Python 3.10+
- FastAPI
- SQLAlchemy + asyncpg (async)
- Neon PostgreSQL (cloud)
- HTML/CSS/JS (vanilla)
- Chart.js (analytics)

## Task Status Values

| Status | Symbol | Meaning |
|--------|--------|---------|
| done | ✔ | 완료 |
| failed | ✖ | 미완료/취소 |
| carry | ▲ | 진행중/이월 |
| null | - | 미정 |

## Categories (seed data)

| Name | Color | Includes |
|------|-------|----------|
| 업무 | #3B82F6 (파랑) | 회사 일 |
| 공부 | #22C55E (초록) | 스터디, 사이드 프로젝트 |
| 운동 | #F97316 (주황) | 헬스, 러닝 등 |
| 수면 | #6366F1 (남색) | 잠 |
| 생활 | #9CA3AF (회색) | 밥, 샤워, 이동 등 |
| 여가 | #EAB308 (노랑) | 놀기, 휴식, 유튜브 등 |

카테고리는 추후 추가/수정 가능.
