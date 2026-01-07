우선순위: 일 단위(Time Tracker)와 JSON 내보내기 우선

이번 페이즈 목표: 일자별(Time Tracker) 기록을 정확히 저장하고 JSON으로 내보내는 MVP를 먼저 만들자. 월/주 스키마와 뷰는 이후에 날짜별 기록을 기반으로 집계하여 구현한다.

세부 작업(우선순위 순)
1. 작업 모델 및 저장소 (MVP)
   - `time_record` 스키마: `id`, `date`, `task_title`, `start_at`, `end_at`, `duration_seconds`, `notes`
   - JSON 저장/로드 유틸: `data/time_records.json` 읽기/쓰기
   - 단위 테스트: 시작/정지 로직과 JSON 저장 확인

2. 간단한 명령 인터페이스
   - `start <task_title>`: 타이머 시작
   - `stop`: 현재 진행 중인 타이머 정지 및 기록 저장
   - `list [--date YYYY-MM-DD]`: 해당 날짜의 기록 목록과 합계 시간 표시
   - `export --date YYYY-MM-DD --out out.json`: 날짜별 JSON 내보내기

3. 데이터 모델 확장(향후)
   - `months` / `weeks` / `days` 테이블 스키마 설계 (SQLite로 전환 시)
   - 주/월 집계 API: 일별 기록 합산

4. UI 확장(선택)
   - 웹(Flask) 또는 GUI(Tkinter)로 날짜 클릭 => 일별 타이머 화면 연결

첫 세션(이번 주) 산출물

진행 방식


# 작업 분해 구조 — 할 일 목록과 시간 추적기

목표: 학습을 중심으로 한 작은 할 일 목록 앱을 만들고, 각 작업에 대한 시간 추적 기능을 추가합니다. 구현하면서 기초를 학습하는 것을 목표로 합니다.

단계별 작업

1. 프로젝트 설정 (0.5–1시간)
   - 저장소 구조 및 `README.md` 생성 (완료)
   - 기술 스택과 UI 결정 (CLI 권장)

2. 작업 모델 및 저장소 (1–2시간)
   - 작업 스키마 정의: `id`, `title`, `notes`, `created_at`, `completed`, `time_records`
   - JSON 저장 도우미 구현: `data/tasks.json`에서 로드/저장
   - 단위 테스트: 작업 CRUD 동작 테스트

3. 시간 추적 핵심 (2–3시간)
   - 시간 레코드 모델 구현: `start_time`, `end_time`, `duration`(초)
   - 시작/정지 함수 구현: `start_task(task_id)`, `stop_task(task_id)`
   - 중복 추적 처리: 다른 작업이 이미 진행 중이면 경고 또는 자동 중지 처리

4. CLI UI (2–4시간)
   - 명령들:
     - `add` — 작업 추가
     - `list` — 총 추적 시간을 포함한 작업 목록 표시
     - `start` — 작업 시간 추적 시작
     - `stop` — 작업 시간 추적 중지
     - `report` — 작업별 / 날짜 범위별 시간 보고
   - 입력 검증 및 친절한 메시지 제공

5. 영속성 및 내보내기 (1–2시간)
   - 작업과 시간 기록을 JSON으로 저장
   - 보고서 CSV 내보내기 추가

6. 테스트, 문서화, 다듬기 (1–2시간)
   - 시간 계산 및 저장소 관련 테스트 추가
   - `README.md`와 예제 개선

예상 시간은 대략적이며 학습 속도에 따라 조정하세요. 작은 커밋과 테스트를 우선하세요.

첫 세션(이번 주) 산출물

협업 방식

