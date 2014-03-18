__author__ = 'max'

import os
from flask import Flask

app = Flask(__name__)
app.config.from_object(__name__)

app.config.update(dict(
    DATABASE=os.path.join(app.root_path, 'database.db'),
    SECRET_KEY=os.urandom(24),
    DEBUG=False
))
