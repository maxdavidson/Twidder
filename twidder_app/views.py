import time

__author__ = 'max'

import json

from flask import g, request, jsonify

from app import app
import API


def serialize(response):
    code = 400 if 'code' not in response else response['code']
    if 'code' in response:
        del response['code']
    return jsonify(**response), code

@app.route('/ws')
def websocket():
    if request.environ.get('wsgi.websocket'):
        ws = g.ws = request.environ['wsgi.websocket']
        if not hasattr(app, 'websockets'):
            app.websockets = []

        handlers = {
            'signIn': API.sign_in,
            'signOut': API.sign_out,
            'signUp': API.sign_up,
            'changePassword': API.change_password,
            'getUserMessagesByToken': API.get_user_messages_by_token,
            'getUserMessagesByEmail': API.get_user_messages_by_email,
            'getUserDataByToken': API.get_user_data_by_token,
            'getUserDataByEmail': API.get_user_data_by_email,
            'postMessage': API.post_message
        }

        while True:
            message = ws.receive()
            if message is None:
                break
            parsed_message = json.loads(message)
            event = parsed_message['event']
            if event in handlers:
                try:
                    start_time = time.time()
                    response = {
                        'success': True,
                        'event': event,
                        'id': parsed_message['id'],
                        'data': handlers[event](**parsed_message['data'])
                    }
                    print '%.4fs: %s' % (time.time() - start_time, event)
                    if ws not in app.websockets:
                        app.websockets.append(ws)
                except TypeError:
                    response = {'success': False, 'message': 'Misformatted data!'}
            else:
                response = {'success': False, 'message': 'No handler specified!'}

            ws.send(json.dumps(response))

        if ws in app.websockets:
            app.websockets.remove(ws)
        ws.close()

    return jsonify({'success': False, 'message': 'Socket is closed'})


@app.route('/')
def main():
    return app.send_static_file('client.html')


@app.route('/<filename>')
def send_foo(filename):
    return app.send_static_file(filename)


@app.route('/user', methods=['GET', 'PUT', 'POST'])
def user():
    data = request.values.to_dict()
    rp = None
    try:
        if request.method == 'POST':
            rp = API.sign_up(**data)
        elif request.method == 'GET':
            rp = API.get_user_data_by_email(**data)
        elif request.method == 'PUT':
            rp = API.change_password(**data)
    except TypeError:
        rp = {'success': False, 'message': 'Misformatted data.', 'code': 400}
    return serialize(rp)


@app.route('/message', methods=['GET', 'POST'])
def message():
    data = request.values.to_dict()
    rp = None
    try:
        if request.method == 'GET':
            rp = API.get_user_messages_by_email(**data)
        elif request.method == 'POST':
            rp = API.post_message(**data)
    except TypeError:
        rp = {'success': False, 'message': 'Misformatted data.', 'code': 400}
    return serialize(rp)


@app.route('/session', methods=['POST', 'DELETE'])
def session():
    data = request.values.to_dict()
    rp = None
    try:
        if request.method == 'POST':
            rp = API.sign_in(**data)
        elif request.method == 'DELETE':
            rp = API.sign_out(**data)
    except TypeError:
        rp = {'success': False, 'message': 'Misformatted data.', 'code': 400}
    return serialize(rp)
