import os
import sys
from datetime import datetime
from flask import Flask, render_template, request, jsonify, g, send_file
import psycopg2
import psycopg2.extras
import io
import csv

# Windows 콘솔 cp949 인코딩 문제 방지
if sys.platform == 'win32' and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

app = Flask(__name__)

DATABASE_URL = os.environ['DATABASE_URL']


def get_db():
    """요청 단위 PostgreSQL(Supabase) DB 커넥션 관리"""
    if 'db' not in g:
        g.db = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return g.db


@app.teardown_appcontext
def close_db(error):
    """요청 종료 시 DB 커넥션 자동 해제"""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def with_achievement_rate(row):
    """목표값 대비 현재값으로 달성률(%)을 계산해 응답에 포함"""
    kpi = dict(row)
    target = kpi.get('target_value') or 0
    current = kpi.get('current_value') or 0
    if target and float(target) > 0:
        kpi['achievement_rate'] = round(float(current) / float(target) * 100, 1)
    else:
        kpi['achievement_rate'] = 0.0
    return kpi


def init_db():
    """데이터베이스 및 테이블 초기화 및 초기 샘플 데이터 시딩"""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS kpis (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            owner TEXT,
            department TEXT DEFAULT '영업팀',
            kpi_type TEXT DEFAULT '성장',
            unit TEXT,
            target_value NUMERIC DEFAULT 0,
            current_value NUMERIC DEFAULT 0,
            start_date TEXT,
            end_date TEXT,
            status TEXT DEFAULT '진행중',
            memo TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    ''')

    # 테이블이 비어있으면 초기 샘플 데이터 생성
    cursor.execute('SELECT COUNT(*) FROM kpis')
    count = cursor.fetchone()[0]
    if count == 0:
        today = datetime.now()
        month_start = today.replace(day=1).strftime('%Y-%m-%d')
        month_end = today.strftime('%Y-%m-%d')
        sample_kpis = [
            (
                '신규 고객 확보',
                '월간 신규 고객 유치 목표',
                '홍길동',
                '영업팀',
                '고객',
                '명',
                100,
                75,
                month_start,
                month_end,
                '진행중',
                '온라인 채널 중심 리드 확보 강화'
            ),
            (
                '분기 매출 목표 달성',
                '분기별 영업 매출 목표',
                '김영희',
                '영업팀',
                '재무',
                '백만원',
                500,
                520,
                month_start,
                month_end,
                '완료',
                '목표 대비 초과 달성'
            ),
            (
                '품질 검증 자동화 커버리지',
                '제조/개발 공정 품질 관리 지표',
                '이철수',
                '개발팀',
                '프로세스',
                '%',
                80,
                45,
                month_start,
                month_end,
                '지연',
                '자동화 테스트 도입 일정 지연 중, 리소스 추가 투입 필요'
            ),
            (
                '직원 역량 강화 교육 이수율',
                '사내 KPI 관리 역량 강화 교육 프로그램 이수',
                '박민수',
                '경영지원팀',
                '성장',
                '%',
                100,
                60,
                month_start,
                month_end,
                '진행중',
                '3분기 내 전 직원 이수 목표'
            )
        ]
        cursor.executemany('''
            INSERT INTO kpis (name, description, owner, department, kpi_type, unit, target_value, current_value, start_date, end_date, status, memo, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        ''', sample_kpis)
        conn.commit()

    conn.close()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/kpis', methods=['GET'])
def get_kpis():
    db = get_db()
    cursor = db.cursor()

    status = request.args.get('status', 'all')  # all, pending, completed
    kpi_status = request.args.get('kpi_status', 'all')
    kpi_type = request.args.get('kpi_type', 'all')
    department = request.args.get('department', 'all')
    search = request.args.get('q', '').strip()
    sort_by = request.args.get('sort', 'created_desc')

    query = 'SELECT * FROM kpis WHERE 1=1'
    params = []

    if status == 'pending':
        query += " AND status != '완료'"
    elif status == 'completed':
        query += " AND status = '완료'"

    if kpi_status != 'all':
        query += ' AND status = %s'
        params.append(kpi_status)

    if kpi_type != 'all':
        query += ' AND kpi_type = %s'
        params.append(kpi_type)

    if department != 'all':
        query += ' AND department = %s'
        params.append(department)

    if search:
        query += ' AND (name ILIKE %s OR description ILIKE %s OR memo ILIKE %s)'
        wildcard = f'%{search}%'
        params.extend([wildcard, wildcard, wildcard])

    # 정렬 방식
    sort_mapping = {
        'created_desc': 'ORDER BY created_at DESC, id DESC',
        'created_asc': 'ORDER BY created_at ASC, id ASC',
        'due_asc': "ORDER BY CASE WHEN end_date IS NULL OR end_date = '' THEN 1 ELSE 0 END, end_date ASC, id DESC",
        'achievement_desc': "ORDER BY CASE WHEN target_value > 0 THEN current_value / target_value ELSE 0 END DESC, id DESC"
    }
    query += ' ' + sort_mapping.get(sort_by, sort_mapping['created_desc'])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    kpis = [with_achievement_rate(row) for row in rows]
    return jsonify(kpis)


@app.route('/api/kpis', methods=['POST'])
def create_kpi():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'KPI 이름을 입력해주세요.'}), 400

    description = data.get('description', '').strip() or None
    owner = data.get('owner', '').strip() or None
    department = data.get('department', '영업팀').strip() or '영업팀'
    kpi_type = data.get('kpi_type', '성장').strip() or '성장'
    unit = data.get('unit', '').strip() or None
    target_value = data.get('target_value') or 0
    current_value = data.get('current_value') or 0
    start_date = data.get('start_date', '').strip() or None
    end_date = data.get('end_date', '').strip() or None
    status = data.get('status', '진행중').strip() or '진행중'
    memo = data.get('memo', '').strip() or None

    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        INSERT INTO kpis (name, description, owner, department, kpi_type, unit, target_value, current_value, start_date, end_date, status, memo, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        RETURNING id
    ''', (name, description, owner, department, kpi_type, unit, target_value, current_value, start_date, end_date, status, memo))
    kpi_id = cursor.fetchone()['id']
    db.commit()

    cursor.execute('SELECT * FROM kpis WHERE id = %s', (kpi_id,))
    new_kpi = with_achievement_rate(cursor.fetchone())
    return jsonify(new_kpi), 201


@app.route('/api/kpis/<int:kpi_id>', methods=['PUT'])
def update_kpi(kpi_id):
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'KPI 이름을 입력해주세요.'}), 400

    description = data.get('description', '').strip() or None
    owner = data.get('owner', '').strip() or None
    department = data.get('department', '영업팀').strip() or '영업팀'
    kpi_type = data.get('kpi_type', '성장').strip() or '성장'
    unit = data.get('unit', '').strip() or None
    target_value = data.get('target_value') or 0
    current_value = data.get('current_value') or 0
    start_date = data.get('start_date', '').strip() or None
    end_date = data.get('end_date', '').strip() or None
    status = data.get('status', '진행중').strip() or '진행중'
    memo = data.get('memo', '').strip() or None

    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        UPDATE kpis
        SET name = %s, description = %s, owner = %s, department = %s, kpi_type = %s, unit = %s,
            target_value = %s, current_value = %s, start_date = %s, end_date = %s, status = %s, memo = %s,
            updated_at = NOW()
        WHERE id = %s
    ''', (name, description, owner, department, kpi_type, unit, target_value, current_value, start_date, end_date, status, memo, kpi_id))
    db.commit()

    if cursor.rowcount == 0:
        return jsonify({'error': '해당 KPI를 찾을 수 없습니다.'}), 404

    cursor.execute('SELECT * FROM kpis WHERE id = %s', (kpi_id,))
    updated_kpi = with_achievement_rate(cursor.fetchone())
    return jsonify(updated_kpi)


@app.route('/api/kpis/<int:kpi_id>/toggle', methods=['PATCH'])
def toggle_kpi(kpi_id):
    """진행중 <-> 완료 상태를 빠르게 전환"""
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT status FROM kpis WHERE id = %s', (kpi_id,))
    row = cursor.fetchone()
    if not row:
        return jsonify({'error': '해당 KPI를 찾을 수 없습니다.'}), 404

    new_status = '진행중' if row['status'] == '완료' else '완료'
    cursor.execute('''
        UPDATE kpis
        SET status = %s, updated_at = NOW()
        WHERE id = %s
    ''', (new_status, kpi_id))
    db.commit()

    cursor.execute('SELECT * FROM kpis WHERE id = %s', (kpi_id,))
    updated_kpi = with_achievement_rate(cursor.fetchone())
    return jsonify(updated_kpi)


@app.route('/api/kpis/<int:kpi_id>', methods=['DELETE'])
def delete_kpi(kpi_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('DELETE FROM kpis WHERE id = %s', (kpi_id,))
    db.commit()
    if cursor.rowcount == 0:
        return jsonify({'error': '해당 KPI를 찾을 수 없습니다.'}), 404
    return jsonify({'success': True, 'id': kpi_id})


@app.route('/api/kpis/clear-completed', methods=['POST'])
def clear_completed():
    db = get_db()
    cursor = db.cursor()
    cursor.execute("DELETE FROM kpis WHERE status = '완료'")
    deleted_count = cursor.rowcount
    db.commit()
    return jsonify({'success': True, 'deleted_count': deleted_count})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    db = get_db()
    cursor = db.cursor()

    cursor.execute('SELECT COUNT(*) FROM kpis')
    total = cursor.fetchone()['count']

    cursor.execute("SELECT COUNT(*) FROM kpis WHERE status = '완료'")
    completed = cursor.fetchone()['count']

    pending = total - completed

    cursor.execute('SELECT target_value, current_value FROM kpis')
    rate_rows = cursor.fetchall()
    rates = []
    for r in rate_rows:
        target = r['target_value'] or 0
        current = r['current_value'] or 0
        rates.append(float(current) / float(target) * 100 if target and float(target) > 0 else 0.0)
    avg_achievement_rate = round(sum(rates) / len(rates), 1) if rates else 0.0

    cursor.execute("SELECT COUNT(*) FROM kpis WHERE status = '지연'")
    at_risk_count = cursor.fetchone()['count']

    # KPI 유형별 분포
    cursor.execute('SELECT kpi_type, COUNT(*) as count FROM kpis GROUP BY kpi_type')
    type_distribution = {row['kpi_type']: row['count'] for row in cursor.fetchall()}

    return jsonify({
        'total': total,
        'completed': completed,
        'pending': pending,
        'avg_achievement_rate': avg_achievement_rate,
        'at_risk_count': at_risk_count,
        'type_distribution': type_distribution
    })


@app.route('/api/export/csv', methods=['GET'])
def export_csv():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT id, name, description, owner, department, kpi_type, unit,
               target_value, current_value, start_date, end_date, status, memo, created_at
        FROM kpis ORDER BY id ASC
    ''')
    rows = cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'KPI 이름', '설명', '담당자', '부서', 'KPI 유형', '측정단위', '목표값', '현재값', '달성률(%)', '시작일', '종료일', '상태', '메모', '생성일시'])

    for r in rows:
        kpi = with_achievement_rate(r)
        writer.writerow([
            kpi['id'],
            kpi['name'],
            kpi['description'] or '',
            kpi['owner'] or '',
            kpi['department'],
            kpi['kpi_type'],
            kpi['unit'] or '',
            kpi['target_value'],
            kpi['current_value'],
            kpi['achievement_rate'],
            kpi['start_date'] or '',
            kpi['end_date'] or '',
            kpi['status'],
            kpi['memo'] or '',
            kpi['created_at']
        ])

    mem = io.BytesIO()
    # Excel 호환을 위해 UTF-8 BOM 인코딩 적용
    mem.write('﻿'.encode('utf-8'))
    mem.write(output.getvalue().encode('utf-8'))
    mem.seek(0)

    filename = f"LIG_DNA_KPIS_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return send_file(
        mem,
        mimetype='text/csv',
        as_attachment=True,
        download_name=filename
    )


init_db()

if __name__ == '__main__':
    print("=" * 60)
    print("  🚀 LIG DNA SMART KPI MANAGER SERVER STARTED")
    print("  🔗 접속 주소: http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host='127.0.0.1', port=5000, debug=True)
