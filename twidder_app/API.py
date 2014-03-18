import time
from datetime import datetime, timedelta

from werkzeug.security import generate_password_hash, check_password_hash
from dateutil import parser

from database_helper import query_db, random_string

from app import app
import json

from flask import g


def get_session_by_token(token):
    if not hasattr(app, 'session_cache'):
        app.session_cache = {}

    if token not in app.session_cache:
        for session in query_db('SELECT * FROM ActiveUsers'):
            if check_password_hash(session['token_hash'], token):
                app.session_cache[token] = session
                break

    if token in app.session_cache:
        session = app.session_cache[token]
        if parser.parse(session['expiration']) > datetime.now():
            return {'success': True, 'message': 'Session data fetched.', 'data': session, 'code': 200}

        query_db('DELETE FROM ActiveUsers WHERE token_hash = ?', [session['token_hash']])
        del app.session_cache[token]
        return {'success': False, 'message': 'Session has expired.', 'code': 401}

    return {'success': False, 'message': 'You are not signed in.', 'code': 401}


def sign_in(email, password):
    """Authenticates the username by the provided password."""
    userdata = query_db('SELECT * FROM Users WHERE email = ?', [email], one=True)
    if userdata is None:
        return {'success': False, 'message': 'No such user.', 'code': 400}

    if check_password_hash(userdata['password_hash'], password):
        token = random_string()
        query_db('INSERT INTO ActiveUsers (user, token_hash, expiration) VALUES (?, ?, ?)',
                 [email, generate_password_hash(token), datetime.now() + timedelta(days=7)])
        return {'success': True, 'message': 'Successfully signed in.', 'data': token, 'code': 200}
    else:
        return {'success': False, 'message': 'Wrong password.', 'code': 400}


def sign_up(email, password, firstname, familyname, gender, city, country):
    """Registers a user in the database."""
    userdata = query_db('SELECT * FROM Users WHERE email = ?', [email], one=True)
    if userdata is not None:
        return {'success': False, 'message': 'User already exists.', 'code': 400}

    query_db('INSERT INTO Users (email, firstname, familyname, gender, city, country, password_hash) '
             'VALUES (?, ?, ?, ?, ?, ?, ?)',
             [email, firstname, familyname, gender, city, country, generate_password_hash(password)])
    return {'success': True, 'message': 'Successfully created a new user', 'code': 200}


def sign_out(token):
    """Signs out a user from the system."""
    session = get_session_by_token(token)
    if not session['success']:
        return {'success': False, 'message': 'You are not signed in.', 'code': 401}

    query_db('DELETE FROM ActiveUsers WHERE token_hash = ?', [session['data']['token_hash']])
    return {'success': True, 'message': 'Successfully signed out.', 'code': 200}


def change_password(token, old_password, new_password):
    """Changes the password of the current user to a new one."""
    session = get_session_by_token(token)
    if not session['success']:
        return session

    response = get_user_data_by_email(token, session['data']['user'], include_hash=True)
    if 'data' not in response:
        return response

    userdata = response['data']
    if check_password_hash(userdata['password_hash'], old_password):
        query_db('UPDATE Users SET password_hash = ? WHERE email = ?',
                 [generate_password_hash(new_password), userdata['email']])
        return {'success': True, 'message': 'Password changed.', 'code': 200}
    else:
        return {'success': False, 'message': 'Wrong password.', 'code': 400}


def get_user_data_by_token(token, include_hash=False):
    """Retrieves the stored data for the user whom the passed token is issued for.
    The currently signed in user can use this method to retrieve all its own information from the server."""
    session = get_session_by_token(token)
    if not session['success']:
        return session

    return get_user_data_by_email(token, session['data']['user'], include_hash)


def get_user_data_by_email(token, email, include_hash=False):
    """Retrieves the stored data for the user specified by the passed email address."""
    session = get_session_by_token(token)
    if not session['success']:
        return session

    data = query_db('SELECT * FROM Users WHERE email = ?', [email], one=True)
    if data is None:
        return {'success': False, 'message': 'No such user.', 'code': 404}

    if not include_hash:
        del data['password_hash']
    return {'success': True, 'message': 'User data retrieved.', 'data': data, 'code': 200}


def get_user_messages_by_token(token):
    """Retrieves the stored messages for the user whom the passed token is issued for.
    The currently signed in user can use this method to retrieve all its own messages from the server."""
    session = get_session_by_token(token)
    if not session['success']:
        return session

    return get_user_messages_by_email(token, session['data']['user'])


def get_user_messages_by_email(token, email):
    """Retrieves the stored messages for the user specified by the passed email address."""
    response = get_user_data_by_token(token)
    if not response['success']:
        return response

    response = get_user_data_by_email(token, email)
    if not response['success']:
        return response

    data = query_db('SELECT * FROM Messages WHERE recipient = ? ORDER BY timestamp DESC', [email])

    for row in data:
        del row['recipient']
        del row['timestamp']

    return {'success': True, 'message': 'User messages retrieved', 'data': data, 'code': 200}


def post_message(token, message, email):
    """Tries to post a message to the wall of the user specified by the email address."""
    response = get_user_data_by_token(token)
    if not response['success']:
        return response
    writer = response['data']

    response = get_user_data_by_email(token, email)
    if not response['success']:
        return response
    recipient = response['data']

    query_db('INSERT INTO Messages (writer, recipient, content) VALUES (?, ?, ?)',
             [writer['email'], recipient['email'], message])

    if hasattr(app, 'websockets'):
        for ws in app.websockets:
            if ws is not g.ws:
                ws.send(json.dumps({
                    'event': 'message',
                    'data': {
                        'recipient': recipient['email'],
                        'messages': [
                            {'writer': writer['email'], 'content': message}
                        ]
                    }
                }))

    return {'success': True, 'message': 'Message posted.', 'code': 200}