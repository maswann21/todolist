# CLI 설계 노트

## 1. CLI 의 역할
- CLI는 프로그램의 입구다
- CLI는 입력을 받아서 models/ storage를 호출하는 입구
- 계산, 검증, 저장 로직을 가지지 않는다.

## 2. CLI에서 하지 않기로 한 것
- ❌ duration 계산 → models 책임
- ❌ 날짜/시간 형식 검증 → models 책임
- ❌ JSON 직접 읽기/쓰기 → storage 책임
### 왜?
- 책임 분리
- 나중에 CLI 교체(Web/GUI) 대비

## 3. 사용 명령 스펠 (타이머 없음 버전)
### 명령 목록
- `add`
- `list`
- `export`

### 예시명령
``` bash 
python -m timetracker.cli add --date YYYY-MM-DD --title TEXT --start HH:MM --end HH:MM [--notes TEXT]
python -m timetracker.cli list [--date YYYY-MM-DD]
python -m timetracker.cli export --date YYYY-MM-DD --out out.json
```

## 4. 명령별 책임 정리(핵심 파트)
### add
- 입력: date, title, start, end, notes
- 호출:
    - `TimeRecord.create()`
    - `append_record()`
- 출력: 성공 메시지

### list
- 입력: (옵션) date
- 호출:
    - `load_records()`
    - 날짜 필터
- 출력:
    - 기록 목록
    - 합계 시간 (표시용 계산)

### export
- 입력: date, out
- 호출:
    - `export_date()`
- 출력: 파일 생성 완료 메시지

## 5. CLI에서 합계 계산을 허용하는 이유
```
list 명령의 합계 계산은 저장 데이터 구조를 변경하지 않는
“출력용 계산(presentation logic)”이므로 CLI에서 수행해도 된다.
```

## 6. 에러 처리 전략
### 요지
- models/ storage는 `ValueError`를 던진다
- CLI는 이를 잡아서 사람이 이해할 수 있는 메시지로 출력
### 예:
- X Traceback 노출
- O "Error: end_at must be later than start_at"

## 7. 왜 subparser 구조를 썻는가
### 포인트
- `add`, `list`, `export`는 사실상 서로 다른 프로그램
- 하나의 parser 안에서 분기하면 가독성과 확장성 저하
- subparser는 명령 책임을 명확히 나눔

## 8. 전체 실행 흐름 요약
```
User Input
 → argparse
 → command 분기
 → models / storage 호출
 → 출력
```