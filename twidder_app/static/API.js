/**
 * Created by max on 2014-03-11.
 */

/**
 * Definierar metoder för att kommunicera med en backend
 * @class
 * @abstract
 * @extends {Framework.EventAggregator}
 */
var Connector = (function (EventAggregator) {

    // Måste kunna:
    // navigera => trigga 'navigate'
    // komma åt cache => requesta 'cache'

    /**
     * @constructs
     */
    function Connector() {}

    Connector.prototype = new EventAggregator;
    Connector.prototype.constructor = Connector;

    /**
     * @static
     * @param {Object} response
     * @returns {*}
     */
    Connector.adapter = function (response) {
        console.log(response['message']);

        if (response['success'])
            return response['data'];
        else throw new Error(response['message']);
    };



    /**
     * Hämtar all saknad användardata för meddelanden, och fixar dem
     * @param {string[]} messages
     * @returns {Framework.Promise}
     */
    Connector.prototype.fetchMissingUserdata = function (messages) {
        if (!Array.isArray(messages)) throw new TypeError('Emails must be an array');

        var cache = this.request('cache');

        var userPromises = messages
            .map(function (message) { return message['writer']; })
            .unique()
            .filter(function (email) { return !cache.get('userdata').keys().contains(email); } )
            .map(this.getUserDataForUser.bind(this));

        return Framework.Promise.all(userPromises)
            .then(function (userdatas) {
                var tmp = cache.get('userdata');
                userdatas.forEach(function (userdata) {
                    tmp[userdata['email']] = userdata;
                });
                cache.set('userdata', tmp);
            })
            .then(function () {
                messages.forEach(function (message) {
                    message['writer'] = cache.get('userdata')[message['writer']];
                });
                return messages;
            });
    };

    /**
     * @returns {boolean}
     */
    Connector.prototype.isLoggedIn = function () {
        var cache = this.request('cache');
        return !!cache.get('token');
    };

    /**
     * Försöker logga ut användaren
     * @abstract
     * @param {string} username
     * @param {string} password
     * @returns {Framework.Promise<String>}
     */
    Connector.prototype.signIn = function (username, password) {
        throw new Error('Must be implemented by subclass!');
    };

    /**
     * Försöker logga ut användaren
     * @abstract
     * @returns {Framework.Promise<Object>}
     */
    Connector.prototype.signOut = function () {
        throw new Error('Must be implemented by subclass!');
    };

    /**
     * Försöker skapa en ny användare med given data
     * @abstract
     * @param {Object} data
     * @returns {Framework.Promise<null>}
     */
    Connector.prototype.signUp = function (data) {
        throw new Error('Must be implemented by subclass!');
    };

    /**
     * Försöker byta lösenord
     * @abstract
     * @param {string} oldPassword
     * @param {string} newPassword
     * @returns {Framework.Promise<null>}
     */
    Connector.prototype.changePassword = function (oldPassword, newPassword) {
        throw new Error('Must be implemented by subclass!');
    };

    /**
     * Försöker hämta wallposts för den inloggade användaren
     * @returns {Framework.Promise<Array>}
     */
    Connector.prototype.getUserMessages = function () {
        var cache = this.request('cache');
        return this.getUserMessagesForUser(cache.get('user'));
    };

    /**
     * Försöker hämta wallposts för en specifik använder
     * @abstract
     * @param {string} email
     * @returns {Framework.Promise<Array>}
     */
    Connector.prototype.getUserMessagesForUser = function (email) {
        throw new Error('Must be implemented by subclass!');
    };

    /**
     * Försöker hämta användardata för den inloggade användaren
     * @returns {Framework.Promise<Object>}
     */
    Connector.prototype.getUserData = function () {
        var cache = this.request('cache');
        return this.getUserDataForUser(cache.get('user'));
    };

    /**
     * Försöker hämta användardata för en viss användare
     * @abstract
     * @param {string} email
     * @returns {Framework.Promise<Object>}
     */
    Connector.prototype.getUserDataForUser = function (email) {
        throw new Error('Must be implemented by subclass!');
    };

    /**
     * Försöker skicka ett meddelande till en annan användare
     * @abstract
     * @param {string} message
     * @param {string} [email]
     * @returns {Framework.Promise<Object>}
     */
    Connector.prototype.postMessage = function (message, email) {
        throw new Error('Must be implemented by subclass!');
    };

    return Connector;
})(Framework.EventAggregator);

/**
 * Konstruerar Connectors utifrån givna löften (promises)
 */
var ConnectorTemplates = {

    signIn: function (promise) {
        return function (username, password) {
            if (typeof username !== 'string') throw new TypeError('Username must be a string');
            if (typeof password !== 'string') throw new TypeError('Password must be a string');
            var that = this, cache = this.request('cache');
            return promise
                .then(Connector.adapter)
                .then(function (token) {
                    cache.set('token', token);
                    cache.set('user', username);
                    if (cache.get('userdata') === null || cache.get('userdata') === undefined)
                        throw new Error('No userdata property set...');
                    if (!(username in cache.get('userdata')))
                        return that.getUserDataForUser(username)
                            .then(function (userdata) {
                                var tmp = cache.get('userdata');
                                tmp[username] = userdata;
                                cache.set('userdata', tmp);
                                return token;
                            });
                })
                .then(function (token) {
                    that.trigger('session', 'signin', username);
                    return token;
                });
        };
    },

    signOut: function (promise) {
        return function () {
            var that = this, cache = this.request('cache');
            return promise
                .then(Connector.adapter)
                .then(function (data) {
                    that.trigger('session', 'signout', cache.get('user'));
                    cache.remove('token');
                    cache.remove('user');
                    return data;
                });
            };
    },

    signUp: function (promise) {
        return function (data) {
            if (typeof data !== 'object') throw new TypeError('Data must be an object');

            var that = this;

            return promise
                .then(Connector.adapter)
                .then(function () {
                    that.trigger('session', 'signup', data['email']);
                    return that.signIn(data['email'], data['password']);
                });
        };
    },

    changePassword: function (promise) {
        return function (oldPassword, newPassword) {
            if (typeof oldPassword !== 'string' || typeof newPassword !== 'string')
                throw new TypeError('Password must be a string');
            return promise.then(Connector.adapter)
        };
    },

    getUserMessagesForUser: function (promise) {
        return function (email) {
            if (typeof email !== 'string') throw new TypeError('Email must be a string');
            var that = this;
            return promise
                .then(Connector.adapter)
                .then(this.fetchMissingUserdata.bind(this))
                .then(function (messages) {
                    that.trigger('messages', 'clear', email);
                    that.trigger('messages', 'recieve', email, messages);
                    return messages;
                });
        };
    },

    getUserDataForUser: function (promise) {
        return function (email) {
            if (typeof email !== 'string') throw new TypeError('Email must be a string');
            return promise.then(Connector.adapter);
        };
    },

    postMessage: function (promise) {
        return function (message, email) {
            if (typeof message !== 'string') throw new TypeError('Message must be a string');
            if (typeof email !== 'string') throw new TypeError('Email must be a string');
            var that = this, cache = this.request('cache');
            return promise
                .then(Connector.adapter)
                .then(function (data) {
                    that.trigger('messages', 'send', email, [{
                        'writer': cache.get('userdata')[cache.get('user')],
                        'content': message
                    }]);
                    return data;
                });
        };
    }

};


/**
 * Implementerar Connector-metoderna mot en Ajax-backend
 * @class
 * @extends {Connector}
 */
var AjaxConnector = (function (Connector) {
    function AjaxConnector() {
        Connector.call(this);
    }

    AjaxConnector.prototype = new Connector;
    AjaxConnector.prototype.constructor = AjaxConnector;

    /**
     * Försöker logga ut användaren
     * @override
     * @param {string} username
     * @param {string} password
     * @returns {Framework.Promise<String>}
     */
    AjaxConnector.prototype.signIn = function (username, password) {
        var promise = Framework.AJAX('POST', '/session', { 'email': username, 'password': password });

        return ConnectorTemplates.signIn(promise).apply(this, arguments);
    };

    /**
     * Försöker logga ut användaren
     * @override
     * @returns {Framework.Promise<Object>}
     */
    AjaxConnector.prototype.signOut = function () {
        var cache = this.request('cache');
        var promise = Framework.AJAX('DELETE', '/session', { 'token': cache.get('token') });

        return ConnectorTemplates.signOut(promise).apply(this, arguments);
    };

    /**
     * Försöker skapa en ny användare med given data
     * @override
     * @param {Object} data
     * @returns {Framework.Promise<null>}
     */
    AjaxConnector.prototype.signUp = function (data) {
        var promise = Framework.AJAX('POST', '/user', data);

        return ConnectorTemplates.signUp(promise).apply(this, arguments);
    };

    /**
     * Försöker byta lösenord
     * @override
     * @param {string} oldPassword
     * @param {string} newPassword
     * @returns {Framework.Promise<null>}
     */
    AjaxConnector.prototype.changePassword = function (oldPassword, newPassword) {
        var cache = this.request('cache');
        var promise = Framework.AJAX('PUT', '/user', {
            'token': cache.get('token'),
            'old_password': oldPassword,
            'new_password': newPassword
        });

        return ConnectorTemplates.changePassword(promise).apply(this, arguments);
    };

    /**
     * Försöker hämta wallposts för en specifik använder
     * @override
     * @param {string} email
     * @returns {Framework.Promise<Array>}
     */
    AjaxConnector.prototype.getUserMessagesForUser = function (email) {
        var cache = this.request('cache');
        var promise = Framework.AJAX('GET', '/message', {
            'token': cache.get('token'),
            'email': email
        });

        return ConnectorTemplates.getUserMessagesForUser(promise).apply(this, arguments);
    };

    /**
     * Försöker hämta användardata för en viss användare
     * @override
     * @param {string} email
     * @returns {Framework.Promise<Object>}
     */
    AjaxConnector.prototype.getUserDataForUser = function (email) {
        var cache = this.request('cache');
        var promise = Framework.AJAX('GET', '/user', {
            'token': cache.get('token'),
            'email': email
        });

        return ConnectorTemplates.getUserDataForUser(promise).apply(this, arguments);
    };

    /**
     * @param {string} message
     * @param {string} [email]
     * @returns {Framework.Promise<Object>}
     */
    AjaxConnector.prototype.postMessage = function (message, email) {
        var cache = this.request('cache');
        var promise = Framework.AJAX('POST', '/message', {
            'token': cache.get('token'),
            'message': message,
            'email': email
        });

        return ConnectorTemplates.postMessage(promise).apply(this, arguments);
    };

    return AjaxConnector;

})(Connector);


/**
 * Implementerar Connector-metoderna mot en localStorage-backend
 * @class
 * @extends {Connector}
 */
var LocalStorageConnector = (function (Connector) {

    var FAKE_DELAY = 150;

    function LocalStorageConnector() {
        Connector.call(this);
    }

    LocalStorageConnector.prototype = new Connector;
    LocalStorageConnector.prototype.constructor = LocalStorageConnector;

    /**
     * Försöker logga ut användaren
     * @override
     * @param {string} username
     * @param {string} password
     * @returns {Framework.Promise<String>}
     */
    LocalStorageConnector.prototype.signIn = function (username, password) {
        var promise = new Framework.Promise(function (resolve) {
            resolve(serverstub.signIn(username, password));
        }).wait(FAKE_DELAY);

        return ConnectorTemplates.signIn(promise).apply(this, arguments);
    };

    /**
     * Försöker logga ut användaren
     * @override
     * @returns {Framework.Promise<Object>}
     */
    LocalStorageConnector.prototype.signOut = function () {
        var cache = this.request('cache');
        var promise = new Framework.Promise(function (resolve) {
            resolve(serverstub.signOut(cache.get('token')));
        }).wait(FAKE_DELAY);

        return ConnectorTemplates.signOut(promise).apply(this, arguments);
    };

    /**
     * Försöker skapa en ny användare med given data
     * @override
     * @param {Object} data
     * @returns {Framework.Promise<null>}
     */
    LocalStorageConnector.prototype.signUp = function (data) {
        var promise = new Framework.Promise(function (resolve) {
            resolve(serverstub.signUp(data));
        }).wait(FAKE_DELAY);

        return ConnectorTemplates.signUp(promise).apply(this, arguments);
    };

    /**
     * Försöker byta lösenord
     * @override
     * @param {string} oldPassword
     * @param {string} newPassword
     * @returns {Framework.Promise<null>}
     */
    LocalStorageConnector.prototype.changePassword = function (oldPassword, newPassword) {
        var cache = this.request('cache');
        var promise = new Framework.Promise(function (resolve) {
            resolve(serverstub.changePassword(cache.get('token'), oldPassword, newPassword));
        }).wait(FAKE_DELAY);

        return ConnectorTemplates.changePassword(promise).apply(this, arguments);
    };

    /**
     * Försöker hämta wallposts för en specifik använder
     * @override
     * @param {string} email
     * @returns {Framework.Promise<Array>}
     */
    LocalStorageConnector.prototype.getUserMessagesForUser = function (email) {
        var cache = this.request('cache');
        var promise = new Framework.Promise(function (resolve) {
            resolve(serverstub.getUserMessagesByToken(cache.get('token')));
        }).wait(FAKE_DELAY);

        return ConnectorTemplates.getUserMessagesForUser(promise).apply(this, arguments);
    };

    /**
     * Försöker hämta användardata för en viss användare
     * @override
     * @param {string} email
     * @returns {Framework.Promise<Object>}
     */
    LocalStorageConnector.prototype.getUserDataForUser = function (email) {
        var cache = this.request('cache');
        var promise = Framework.Promise(function (resolve) {
            resolve(serverstub.getUserDataByEmail(cache.get('token'), email));
        }).wait(FAKE_DELAY);

        return ConnectorTemplates.getUserDataForUser(promise).apply(this, arguments);
    };

    /**
     * @param {string} message
     * @param {string} [email]
     * @returns {Framework.Promise<Object>}
     */
    LocalStorageConnector.prototype.postMessage = function (message, email) {
        var cache = this.request('cache');
        var promise = new Framework.Promise(function (resolve) {
            resolve(serverstub.postMessage(cache.get('token'), message, email || cache.get('user')));
        }).wait(FAKE_DELAY);

        return ConnectorTemplates.postMessage(promise).apply(this, arguments);
    };

    return LocalStorageConnector;

})(Connector);


/**
 * Implementerar Connector-metoderna mot en WebSocket-backend
 * @class
 * @extends {Connector}
 */
var WebSocketConnector = (function (Connector) {

    function WebSocketConnector() {
        Connector.call(this);

        this.socket = new Framework.Socket('ws://' + window.location.host + '/ws');
        //this.socket.on('all', function () { if (arguments[0].indexOf(':') === -1) console.log([this].concat([].slice.call(arguments))); });

        var that = this;
        this.socket.on('message:message', function (data) {
            that.fetchMissingUserdata(data['messages'])
                .then(function (messages) {
                    that.trigger('messages', 'recieve', data['recipient'], messages);
                });
        });
    }

    WebSocketConnector.prototype = new Connector;
    WebSocketConnector.prototype.constructor = WebSocketConnector;

    /**
     * Försöker logga ut användaren
     * @override
     * @param {string} username
     * @param {string} password
     * @returns {Framework.Promise<String>}
     */
    WebSocketConnector.prototype.signIn = function (username, password) {
        var promise = this.socket.send('signIn', {
            'email': username,
            'password': password
        });

        return ConnectorTemplates.signIn(promise).apply(this, arguments);
    };

    /**
     * Försöker logga ut användaren
     * @override
     * @returns {Framework.Promise<Object>}
     */
    WebSocketConnector.prototype.signOut = function () {
        var cache = this.request('cache');
        var promise = this.socket.send('signOut', {
                'token': cache.get('token')
            });

        return ConnectorTemplates.signOut(promise).apply(this, arguments);
    };

    /**
     * Försöker skapa en ny användare med given data
     * @override
     * @param {Object} data
     * @returns {Framework.Promise<null>}
     */
    WebSocketConnector.prototype.signUp = function (data) {
        var promise = this.socket.send('signUp', data);

        return ConnectorTemplates.signUp(promise).apply(this, arguments);
    };

    /**
     * Försöker byta lösenord
     * @override
     * @param {string} oldPassword
     * @param {string} newPassword
     * @returns {Framework.Promise<null>}
     */
    WebSocketConnector.prototype.changePassword = function (oldPassword, newPassword) {
        cache = this.request('cache');
        var promise =  this.socket.send('changePassword', {
            'token': cache.get('token'),
            'old_password': oldPassword,
            'new_password': newPassword
        });

        return ConnectorTemplates.changePassword(promise).apply(this, arguments);
    };

    /**
     * Försöker hämta wallposts för en specifik använder
     * @override
     * @param {string} email
     * @returns {Framework.Promise<Array>}
     */
    WebSocketConnector.prototype.getUserMessagesForUser = function (email) {
        var cache = this.request('cache');
        var promise = this.socket.send('getUserMessagesByEmail', {
            'token': cache.get('token'),
            'email': email
        });

        return ConnectorTemplates.getUserMessagesForUser(promise).apply(this, arguments);
    };

    /**
     * Försöker hämta användardata för en viss användare
     * @override
     * @param {string} email
     * @returns {Framework.Promise<Object>}
     */
    WebSocketConnector.prototype.getUserDataForUser = function (email) {
        var cache = this.request('cache');
        var promise = this.socket.send('getUserDataByEmail', {
            'token': cache.get('token'),
            'email': email
        });

        return ConnectorTemplates.getUserDataForUser(promise).apply(this, arguments);
    };

    /**
     * @param {string} message
     * @param {string} [email]
     * @returns {Framework.Promise<Object>}
     */
    WebSocketConnector.prototype.postMessage = function (message, email) {
        var cache = this.request('cache');
        var promise = this.socket.send('postMessage', {
            'token': cache.get('token'),
            'message': message,
            'email': email || cache.get('user')
        });

        return ConnectorTemplates.postMessage(promise).apply(this, arguments);
    };

    return WebSocketConnector;

})(Connector);