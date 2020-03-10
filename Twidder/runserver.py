from gevent.pywsgi import WSGIServer
from flask import Flask
from geventwebsocket.handler import WebSocketHandler
from server import app

if __name__ == '__main__':
    http_server = WSGIServer(('', 5000), app, handler_class=WebSocketHandler)
    http_server.serve_forever()
 
