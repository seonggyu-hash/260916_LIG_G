# 🧬 LIG DNA Smart KPI Manager

LIG DNA 핵심가치(**도전·신뢰·첨단·혁신**)를 기반으로 제작된 프리미엄 스마트 KPI(핵심성과지표) 관리 웹 애플리케이션입니다.  
Python Flask 백엔드와 세련된 글래스모피즘(Glassmorphism) 다크/라이트 UI가 결합되어 최상의 사용자 경험을 제공합니다.

---

## ✨ 핵심 기능 소개

1. **KPI 대시보드 & BSC 4대 관점 매트릭스**
   - **재무(Financial) / 고객(Customer) / 프로세스(Process) / 성장(Growth)** 관점별 KPI 현황 및 실시간 카운터
   - 전체 KPI 수, 평균 달성률(%), 지연(위험) KPI 현황 게이지 시각화
   - KPI 유형 뱃지 클릭 시 해당 관점의 KPI만 원클릭 필터링

2. **직관적인 스마트 KPI 관리 (CRUD)**
   - KPI 이름, 설명, 담당자, 부서(영업/마케팅/개발/기획/경영지원), KPI 유형, 측정 단위, 목표값/현재값, 시작일/종료일, 상태(진행중/완료/지연/보류), 상세 메모
   - 목표값 대비 현재값으로 **달성률 자동 계산** 및 진행률 바 시각화
   - 완료 토글 시 Web Audio API 기반의 청명한 효과음(Chime) 및 실시간 스트라이크스루 애니메이션
   - 수정(Modal) 및 삭제 기능, 완료된 KPI 일괄 정리(Batch Clean) 기능

3. **실시간 검색 및 다차원 필터링**
   - KPI명, 설명, 메모 통합 실시간 디바운스 검색
   - 진행 상태별(전체/진행중/완료), 세부 상태별(진행중/완료/지연/보류), 부서별, KPI 유형별 필터
   - 정렬 옵션: 최신순, 오래된순, 종료일 임박순, 달성률 높은순

4. **엑셀 호환 CSV 데이터 내보내기 (Export)**
   - 한글 깨짐 방지 UTF-8 BOM 인코딩이 적용된 CSV 파일 즉시 다운로드 (달성률 포함)

5. **프리미엄 반응형 UI & 단축키**
   - 사이버 슬레이트 딥 다크 모드 & 클린 라이트 모드 실시간 전환 (설정 자동 저장)
   - 실시간 시계 위젯 (날짜 및 요일 표시)
   - 키보드 단축키 지원:
     - `N`: 새 KPI 등록 창 열기
     - `/`: 검색창 바로 포커스
     - `ESC`: 모달 창 닫기

---

## 📁 디렉터리 구조

```
LIG_DNA_TODO_APP/
├── app.py                 # Flask 백엔드 서버 및 RESTful API 라우트
├── requirements.txt       # 의존 패키지 목록 (Flask, psycopg2-binary)
├── vercel.json             # Vercel 서버리스 배포 설정
├── run.bat                # 윈도우 원클릭 실행 배치 파일
├── README.md              # 프로젝트 안내 문서
├── templates/
│   └── index.html         # 메인 웹 페이지 템플릿
└── static/
    ├── css/
    │   └── style.css      # 디자인 시스템, 글래스모피즘, 애니메이션
    └── js/
        └── app.js         # 리액티브 UI 제어, Web Audio 사운드 합성, API 통신
```

---

## 🗄️ 데이터베이스

PostgreSQL(Supabase)을 사용합니다. `DATABASE_URL` 환경변수에 접속 문자열을 설정해야 합니다.

```
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
```

## 🚀 실행 방법

### 방법 1. 간편 실행 (가장 추천)
`DATABASE_URL` 환경변수를 설정한 뒤 폴더 내의 **`run.bat`** 파일을 더블 클릭하면 자동으로 의존성을 확인하고 웹 브라우저(`http://127.0.0.1:5000`)를 열어줍니다.

### 방법 2. 터미널 수동 실행
```powershell
# 1. LIG_DNA_TODO_APP 폴더로 이동
cd LIG_DNA_TODO_APP

# 2. 필수 라이브러리 설치
python -m pip install -r requirements.txt

# 3. DATABASE_URL 환경변수 설정 후 서버 실행
python app.py
```
실행 후 웹 브라우저에서 **`http://127.0.0.1:5000`** 에 접속하시면 바로 사용하실 수 있습니다.

## ☁️ 배포

- **GitHub**: https://github.com/seonggyu-hash/260916_LIG_G
- **Vercel**: `DATABASE_URL` 프로덕션 환경변수가 설정되어 있어야 하며, `vercel --prod`로 배포합니다.
- **Database**: Supabase PostgreSQL (Supavisor Transaction Pooler 사용 권장)
