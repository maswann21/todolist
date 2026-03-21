# Handoff: Daily Time Tracker

## 현재 상태

전체 앱 구현 완료. 백엔드 16개 테스트 통과. **남은 작업: Neon DB 연결 후 실제 테스트.**

## 바로 해야 할 것

1. [neon.tech](https://neon.tech) 가입 → 프로젝트 생성 → Connection string 복사
2. `.env` 파일에 실제 URL 입력:
   ```
   DATABASE_URL=postgresql+asyncpg://your-real-neon-url
   ```
3. 앱 실행:
   ```bash
   uvicorn main:app --reload
   ```
4. `http://127.0.0.1:8000` → 캘린더 확인

**집 노트북에서도**: `git pull` → `.env`에 같은 Neon URL → 동일한 데이터 공유.

## 구현된 것

| 레이어 | 내용 |
|--------|------|
| DB | Neon PostgreSQL, SQLAlchemy 2.0 async, 4개 테이블 |
| API | FastAPI REST: categories / daily-pages / tasks / time-blocks / analytics |
| 캘린더 | 월간 달력, 완료율 표시, 날짜 클릭 → 일별 페이지 |
| 일별 페이지 | 체크리스트 (추가/삭제/상태 순환) + 타임테이블 (드래그 색칠) + 자동저장 |
| 대시보드 | Chart.js: 카테고리 비중(도넛), 완료율(도넛), 일별 추이(스택 바) |

## 알아야 할 것

- **타임테이블**: 체크리스트에서 태스크 클릭 → 선택 → 타임테이블에서 드래그 → 색칠. 선택 없이 드래그 불가.
- **겹침 방지**: 같은 날 어떤 태스크든 시간 블록이 겹치면 409 반환. 프론트에서 alert.
- **10분 스냅**: 시간 블록은 항상 10분 단위로 내림 (9:07 → 9:00).
- **analytics**: PostgreSQL 전용 쿼리 (`EXTRACT(EPOCH FROM time - time)`). SQLite 테스트 없음.
- **상태 초기화**: `PUT /api/tasks/{id}` 에 `{"status": ""}` 보내면 null로 리셋.

## 파일 구조

```
main.py              # 진입점, 라우터 등록, lifespan
db/
  database.py        # engine, async_session, get_db, Settings
  models.py          # Category, DailyPage, Task, TimeBlock
  seed.py            # 6개 카테고리 초기 데이터
api/
  categories.py      # GET /api/categories
  daily_pages.py     # GET/PUT /api/daily-pages/...
  tasks.py           # POST/PUT/DELETE /api/.../tasks/...
  time_blocks.py     # POST/PUT/DELETE /api/time-blocks/...
  analytics.py       # GET /api/analytics/...
static/
  index.html + js/calendar.js   # 캘린더
  day.html   + js/day.js        # 일별 상세
  dashboard.html + js/dashboard.js  # 대시보드
  css/style.css
tests/
  conftest.py        # SQLite fixtures (db, client)
  test_models.py / test_api_*.py
```

## 앞으로 추가할 수 있는 것

- 태스크 드래그로 순서 변경 (priority reorder)
- 카테고리 추가/수정 UI
- 캘린더 셀에 카테고리 색상 표시
- 모바일 반응형 개선
- ETL: Neon → 분석 도구 연동
