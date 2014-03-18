from twidder_app import app

from geventwebsocket.handler import WebSocketHandler
from gevent.pywsgi import WSGIServer


if __name__ == '__main__':
    http_server = WSGIServer(('', 5000), app, handler_class=WebSocketHandler)
    http_server.serve_forever()
    #app.run(host='0.0.0.0')