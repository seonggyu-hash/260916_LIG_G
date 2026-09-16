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


def init_db():
    """데이터베이스 및 테이블 초기화 및 초기 샘플 데이터 시딩"""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS todos (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT DEFAULT '업무',
            dna_tag TEXT DEFAULT '혁신',
            priority TEXT DEFAULT 'medium',
            due_date TEXT,
            memo TEXT,
            completed INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    ''')

    # 테이블이 비어있으면 초기 샘플 데이터 생성
    cursor.execute('SELECT COUNT(*) FROM todos')
    count = cursor.fetchone()[0]
    if count == 0:
        sample_todos = [
            (
                'LIG 스마트 업무 자동화 RPA 워크플로우 검증',
                '개발',
                '첨단',
                'critical',
                datetime.now().strftime('%Y-%m-%d'),
                '파이썬 및 RPA 자동화 파이프라인 무결성 점검',
                0
            ),
            (
                'LIG DNA 핵심가치 기반 스마트 플래닝 기획서 작성',
                '기획',
                '혁신',
                'high',
                datetime.now().strftime('%Y-%m-%d'),
                '도전·신뢰·첨단·혁신 DNA 문화 확산 전략 수립',
                0
            ),
            (
                '부서 주간 협업 회의 아젠다 정리 및 공유',
                '협업',
                '신뢰',
                'medium',
                datetime.now().strftime('%Y-%m-%d'),
                '팀원별 진척도 동기화 및 병목 구간 해소 논의',
                1
            ),
            (
                '신규 기술 트렌드 벤치마킹 분석 보고서 작성',
                '연구',
                '도전',
                'low',
                None,
                '국내외 첨단 테크 동향 및 사례 스터디',
                0
            )
        ]
        cursor.executemany('''
            INSERT INTO todos (title, category, dna_tag, priority, due_date, memo, completed, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        ''', sample_todos)
        conn.commit()

    conn.close()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/todos', methods=['GET'])
def get_todos():
    db = get_db()
    cursor = db.cursor()

    status = request.args.get('status', 'all')  # all, pending, completed
    priority = request.args.get('priority', 'all')
    dna_tag = request.args.get('dna_tag', 'all')
    category = request.args.get('category', 'all')
    search = request.args.get('q', '').strip()
    sort_by = request.args.get('sort', 'created_desc')

    query = 'SELECT * FROM todos WHERE 1=1'
    params = []

    if status == 'pending':
        query += ' AND completed = 0'
    elif status == 'completed':
        query += ' AND completed = 1'

    if priority != 'all':
        query += ' AND priority = %s'
        params.append(priority)

    if dna_tag != 'all':
        query += ' AND dna_tag = %s'
        params.append(dna_tag)

    if category != 'all':
        query += ' AND category = %s'
        params.append(category)

    if search:
        query += ' AND (title ILIKE %s OR memo ILIKE %s)'
        wildcard = f'%{search}%'
        params.extend([wildcard, wildcard])

    # 정렬 방식
    sort_mapping = {
        'created_desc': 'ORDER BY created_at DESC, id DESC',
        'created_asc': 'ORDER BY created_at ASC, id ASC',
        'due_asc': "ORDER BY CASE WHEN due_date IS NULL OR due_date = '' THEN 1 ELSE 0 END, due_date ASC, id DESC",
        'priority_desc': "ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END, id DESC"
    }
    query += ' ' + sort_mapping.get(sort_by, sort_mapping['created_desc'])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    todos = [dict(row) for row in rows]
    return jsonify(todos)


@app.route('/api/todos', methods=['POST'])
def create_todo():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': '할 일 제목을 입력해주세요.'}), 400

    category = data.get('category', '업무').strip() or '업무'
    dna_tag = data.get('dna_tag', '혁신').strip() or '혁신'
    priority = data.get('priority', 'medium').strip() or 'medium'
    due_date = data.get('due_date', '').strip() or None
    memo = data.get('memo', '').strip() or None

    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        INSERT INTO todos (title, category, dna_tag, priority, due_date, memo, completed, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, 0, NOW(), NOW())
        RETURNING id
    ''', (title, category, dna_tag, priority, due_date, memo))
    todo_id = cursor.fetchone()['id']
    db.commit()

    cursor.execute('SELECT * FROM todos WHERE id = %s', (todo_id,))
    new_todo = dict(cursor.fetchone())
    return jsonify(new_todo), 201


@app.route('/api/todos/<int:todo_id>', methods=['PUT'])
def update_todo(todo_id):
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': '할 일 제목을 입력해주세요.'}), 400

    category = data.get('category', '업무').strip() or '업무'
    dna_tag = data.get('dna_tag', '혁신').strip() or '혁신'
    priority = data.get('priority', 'medium').strip() or 'medium'
    due_date = data.get('due_date', '').strip() or None
    memo = data.get('memo', '').strip() or None
    completed = 1 if data.get('completed') else 0

    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        UPDATE todos
        SET title = %s, category = %s, dna_tag = %s, priority = %s, due_date = %s, memo = %s, completed = %s, updated_at = NOW()
        WHERE id = %s
    ''', (title, category, dna_tag, priority, due_date, memo, completed, todo_id))
    db.commit()

    if cursor.rowcount == 0:
        return jsonify({'error': '해당 항목을 찾을 수 없습니다.'}), 404

    cursor.execute('SELECT * FROM todos WHERE id = %s', (todo_id,))
    updated_todo = dict(cursor.fetchone())
    return jsonify(updated_todo)


@app.route('/api/todos/<int:todo_id>/toggle', methods=['PATCH'])
def toggle_todo(todo_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT completed FROM todos WHERE id = %s', (todo_id,))
    row = cursor.fetchone()
    if not row:
        return jsonify({'error': '해당 항목을 찾을 수 없습니다.'}), 404

    new_status = 0 if row['completed'] == 1 else 1
    cursor.execute('''
        UPDATE todos
        SET completed = %s, updated_at = NOW()
        WHERE id = %s
    ''', (new_status, todo_id))
    db.commit()

    cursor.execute('SELECT * FROM todos WHERE id = %s', (todo_id,))
    updated_todo = dict(cursor.fetchone())
    return jsonify(updated_todo)


@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('DELETE FROM todos WHERE id = %s', (todo_id,))
    db.commit()
    if cursor.rowcount == 0:
        return jsonify({'error': '해당 항목을 찾을 수 없습니다.'}), 404
    return jsonify({'success': True, 'id': todo_id})


@app.route('/api/todos/clear-completed', methods=['POST'])
def clear_completed():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('DELETE FROM todos WHERE completed = 1')
    deleted_count = cursor.rowcount
    db.commit()
    return jsonify({'success': True, 'deleted_count': deleted_count})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    db = get_db()
    cursor = db.cursor()

    cursor.execute('SELECT COUNT(*) FROM todos')
    total = cursor.fetchone()['count']

    cursor.execute('SELECT COUNT(*) FROM todos WHERE completed = 1')
    completed = cursor.fetchone()['count']

    pending = total - completed
    rate = round((completed / total * 100) if total > 0 else 0, 1)

    cursor.execute("SELECT COUNT(*) FROM todos WHERE completed = 0 AND priority = 'critical'")
    critical_count = cursor.fetchone()['count']

    # DNA 태그별 분포
    cursor.execute('SELECT dna_tag, COUNT(*) as count FROM todos GROUP BY dna_tag')
    dna_distribution = {row['dna_tag']: row['count'] for row in cursor.fetchall()}

    return jsonify({
        'total': total,
        'completed': completed,
        'pending': pending,
        'completion_rate': rate,
        'critical_count': critical_count,
        'dna_distribution': dna_distribution
    })


@app.route('/api/export/csv', methods=['GET'])
def export_csv():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id, title, category, dna_tag, priority, due_date, completed, memo, created_at FROM todos ORDER BY id ASC')
    rows = cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', '할일 제목', '카테고리', 'DNA가치', '우선순위', '마감일', '완료여부', '메모', '생성일시'])

    for r in rows:
        writer.writerow([
            r['id'],
            r['title'],
            r['category'],
            r['dna_tag'],
            r['priority'],
            r['due_date'] or '',
            '완료' if r['completed'] == 1 else '미완료',
            r['memo'] or '',
            r['created_at']
        ])

    mem = io.BytesIO()
    # Excel 호환을 위해 UTF-8 BOM 인코딩 적용
    mem.write('﻿'.encode('utf-8'))
    mem.write(output.getvalue().encode('utf-8'))
    mem.seek(0)

    filename = f"LIG_DNA_TODOS_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return send_file(
        mem,
        mimetype='text/csv',
        as_attachment=True,
        download_name=filename
    )


init_db()

if __name__ == '__main__':
    print("=" * 60)
    print("  🚀 LIG DNA SMART TODO WEB APP SERVER STARTED")
    print("  🔗 접속 주소: http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host='127.0.0.1', port=5000, debug=True)
