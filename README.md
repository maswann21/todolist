우선 순위: 일별(Time Tracker) 우선 구현
---------------------------------

이 프로젝트는 우선적으로 일 단위(Time Tracker) 기능을 완성하고, 해당 데이터를 JSON으로 내보내는 것을 목표로 합니다. 월/주 뷰는 이후 단계에서 UI로 확장합니다.

일별(Time Tracker) MVP 작업 흐름
-------------------------------
- `time_records` 모델 설계: `id`, `date`, `task_title`, `start_at`, `end_at`, `duration_seconds`, `notes`
- 로컬 저장: 우선 `data/tasks.json` 또는 `data/time_records.json` 형태의 JSON 파일에 저장
- CLI 또는 간단한 스크립트로 `start` / `stop` 명령 구현
- JSON 내보내기: 날짜 범위 또는 일자별로 필터해서 출력

권장 단계(빠른 검증용)
-------------------
1. `time_tracker.py` 스캐폴드 생성: `start(task_title)`, `stop()` 함수와 JSON 저장기능
2. 간단 CLI로 `start`, `stop`, `list` 구현하여 기록 확인
3. JSON 내보내기 명령(`export --date 2026-01-06`) 추가

향후 확장
---------
- Week/Month 뷰: 일별 기록을 합산해 주간/월간 리포트 제공
- UI 확장: Flask 기반의 달력 UI에서 날짜 클릭으로 일별 타이머 열기
- DB 전환 옵션: 로컬 검증 후 `SQLite` 마이그레이션

우선 목표: 수동 기록 → JSON 내보내기 → DB 적재 → 분석/시각화
----------------------------------------------------

당신의 최종 목표를 반영한 현실적인 단계는 다음과 같습니다. 각 단계는 작고 검증 가능한 산출물을 만듭니다.

로드맵(요약)
- 1단계 (MVP, 1–3일): 수동 기록 인터페이스(CLI)로 일별 기록을 빠르게 저장하고 JSON으로 내보내기
- 2단계 (ETL, 1–2일): 생성된 JSON 파일을 `SQLite`로 적재하는 간단한 ETL 스크립트 작성
- 3단계 (분석, 1–2일): 집계 스크립트(일/주/월)와 간단한 통계(총시간, 평균 등) 작성
- 4단계 (시각화, 1–3일): `matplotlib`/`plotly`로 차트 생성(PNG 또는 HTML)

권장 파일/스크립트
- `time_tracker.py` — 수동 기록과(선택적) 간단 타이머 함수 포함
- `data/time_records.json` — 기록 저장소(샘플 포함)
- `etl/load_json_to_sqlite.py` — JSON → SQLite 변환 스크립트
- `analysis/aggregate.py` — 집계 및 통계 함수
- `visualize/chart.py` — 예제 차트 생성 함수

간단한 사용 예제 (CLI 기반 수동 기록)

기록 추가(수동, 분 단위 입력 예):
```powershell
python main.py record --date 2026-01-06 --task "스터디" --duration 90 --notes "알고리즘 공부"
```

기록 목록 확인(날짜):
```powershell
python main.py list --date 2026-01-06
```

JSON 내보내기(날짜):
```powershell
python main.py export --date 2026-01-06 --out out.json
```

ETL(예시):
```powershell
python etl/load_json_to_sqlite.py --in out.json --db data/todos.db
```

분석 예시(집계):
```powershell
python analysis/aggregate.py --db data/todos.db --range 2026-01-01:2026-01-31
```

시각화 예시(차트 생성):
```powershell
python visualize/chart.py --db data/todos.db --out january.png
```

첫 번째 액션(권장)
- 제가 바로 `time_tracker.py` 스캐폴드(수동 기록 + `data/time_records.json` 샘플)와 `main.py`에 간단한 CLI 명령(`record`, `list`, `export`)을 만들어 드릴게요. 원하면 ETL 스크립트까지 한 번에 추가하겠습니다.



할 일 목록 및 시간 추적기
=========================

개요
----

학습을 목적으로 만든 작은 Python 프로젝트로, 할 일(task)을 관리하고 각 작업에 소요된 시간을 추적합니다. 이 저장소는 직접 구현하며 공부하기 좋게 구성되어 있으며, 제가 가이드와 시작 코드(스캐폴드)를 제공합니다.

포함된 항목
-----------
- 간단한 Python 진입점: [main.py](main.py) (기존 파일)
- 프로젝트 계획: [WBS.md](WBS.md)
- 이 파일: [README.md](README.md)

기술 선택(권장)
--------------
- 언어: Python 3.10 이상
- UI: 우선 CLI (학습하기 간단함). 이후 Flask 기반의 간단한 웹 UI로 확장 가능
- 저장소: JSON 파일에 작업 및 시간 기록 저장 (읽기 쉽고 휴대성 좋음)

빠른 시작
---------
1. 가상환경 생성 및 활성화(권장):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. 의존성 설치: 최소 CLI 버전에서는 추가 패키지가 필요하지 않습니다. 필요 시 `requirements.txt`를 추가합니다.

3. 앱 실행(아직 CLI가 구현되지 않았다면 자리표시자):

```powershell
python main.py
```

프로젝트 구조
---------------

- [main.py](main.py) — 앱 진입점
- [WBS.md](WBS.md) — 작업 분해 구조
- [README.md](README.md) — 이 파일

학습 및 개발 계획
------------------
`WBS.md`를 따라 작은 단위로 작업하세요: 먼저 작업 모델과 JSON 저장소를 만들고, 그다음 시간 추적 로직을 추가한 뒤, `add`/`list` 등의 CLI 명령을 구현합니다. 저는 짧은 연습 문제와 구현 지침을 드리거나, 원하시면 스캐폴드 코드를 제공합니다.

기여 방법
--------
제가 시작 코드를 작성하길 원하시면 말씀해주세요. 직접 코딩하시길 원하면, 제가 과제와 확인 질문을 드리는 페어 프로그래밍 방식으로 진행할 수 있습니다.

다음 단계(권장)
--------------
1. 작업 모델 및 JSON 저장소 구현
2. 시작/정지 시간 추적 구현
3. `add`, `list`, `start`, `stop` CLI 명령 추가

연락 / 페어 방식
----------------
원하시는 학습 방식(페어 프로그래밍: 과제/질문 방식 또는 스캐폴드 코드 제공)을 알려주시면 그에 맞춰 진행하겠습니다.
