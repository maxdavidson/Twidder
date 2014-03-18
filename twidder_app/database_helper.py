import sqlite3
import uuid

from flask import g
import time
from app import app


def random_string():
    return uuid.uuid4().hex


def connect_db():
    """Connects to the specific database."""
    db = sqlite3.connect(app.config['DATABASE'])

    def make_dicts(cursor, row):
        return dict((cursor.description[idx][0], value) for idx, value in enumerate(row))

    db.row_factory = make_dicts
    return db


def init_db():
    with app.app_context():
        db = get_db()
        with app.open_resource('schema.sql', mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()


def get_db():
    """Opens a new database connection if there is none yet for the current application context."""
    if not hasattr(g, 'sqlite_db'):
        g.sqlite_db = connect_db()
    return g.sqlite_db


def query_db(query, args=(), one=False):
    db = get_db()
    cur = db.execute(query, args)
    db.commit()
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv


@app.teardown_appcontext
def close_db(nothing):
    """Closes the database again at the end of the ajaxRequest."""
    if hasattr(g, 'sqlite_db'):
        g.sqlite_db.close()
