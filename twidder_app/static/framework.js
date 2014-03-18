
/**
 * Ett litet Backbone-inspirerat Javascript-framework
 * Max Davidson, 2014
 */
var Framework = (function () {
    'use strict';

    // Shamelessly extending built-in objects :)
    (function () {

        // Map polyfill (part of ES6)
        if (!window.Map)
            window.Map = function () {
                var _keys = [];
                var _vals = [];
                this.set = function (key, val) { _keys.push(key); _vals.push(val); };
                this.get = function (key) { return _vals[_keys.indexOf(key)]; };
                this.has = function (val) { return _vals.indexOf(val) > -1; };
                this.delete = function (key) { var i = _keys.indexOf(key); _keys.splice(i, 1); _vals.splice(i, 1); };
                this.forEach = function (handler, context) {
                    for (var i = 0; i < _keys.length; ++i)
                        handler.call(context, _vals[i], _keys[i]);
                };
            };

        // Promise polyfill (part of ES6)
        if (!window.Promise)
            window.Promise = (function () {

                function Handler(onFulfilled, onRejected, resolve, reject) {
                    this.onFulfilled = (typeof onFulfilled === 'function') ? onFulfilled : null;
                    this.onRejected = (typeof onRejected === 'function') ? onRejected : null;
                    this.resolve = resolve;
                    this.reject = reject;
                }

                /**
                 * @param {Function} fn
                 * @constructs
                 */
                function Promise(fn) {
                    if (typeof fn !== 'function') throw new TypeError('Not a function');

                    var state = null; // null=pending, false=rejected, true=resolved
                    var value = null;
                    var handlers = [];

                    this.then = function (onFulfilled, onRejected) {
                        return new Promise(function (resolve, reject) {
                            schedule(new Handler(onFulfilled, onRejected, resolve, reject));
                        });
                    };

                    function schedule(handler) {
                        if (state === null)
                            handlers.push(handler);
                        else {
                            // Kör funktionen uppskjutet
                            (function () {
                                var callback = state ? handler.onFulfilled : handler.onRejected;
                                if (callback === null || callback === undefined)
                                    (state ? handler.resolve : handler.reject)(value);
                                else {
                                    try {
                                        handler.resolve(callback(value));
                                    } catch (e) {
                                        handler.reject(e);
                                    }
                                }
                            }).defer()();
                        }
                    }

                    function resolve(newValue) {
                        if (state !== null) return;
                        try {
                            if (newValue instanceof Promise)
                                newValue.then(resolve, reject);
                            else {
                                state = true;
                                value = newValue;
                                handlers.forEach(schedule);
                                handlers = null;
                            }
                        } catch (e) {
                            reject(e);
                        }
                    }

                    function reject(newValue) {
                        if (state !== null) return;
                        state = false;
                        value = newValue;
                        handlers.forEach(schedule);
                        handlers = null;
                    }

                    fn.defer()(resolve, reject);
                }

                Promise.prototype.catch = function (onRejected) {
                    return this.then(null, onRejected);
                };

                Promise.prototype.wait = function (delay) {
                    return this.then(function (response) {
                        return new Framework.Promise(function (resolve) {
                            setTimeout(resolve.bind(null, response), delay);
                        });
                    });
                };

                /**
                 * Returnerar en Promise som resolvas när alla inputpromises har resolvats
                 * @param {Promise[]} promises...
                 * @returns {Promise}
                 */
                Promise.all = function (promises) {
                    promises = Array.isArray(promises) ? promises : [].slice.call(arguments);

                    var values = [];
                    return new Promise(function (resolve, reject) {
                        try {
                            if (promises === null || promises === undefined || promises.length === 0) resolve(values);
                            promises.forEach(function (promise) {
                                if (!(promise instanceof Promise)) throw new TypeError('Not a promise!');
                                promise.then(function (value) {
                                    values.push(value);
                                    if (values.length === promises.length)
                                        resolve(values);
                                }, function () {
                                    throw new Error;
                                });
                            });
                        } catch (e) {
                            reject(e);
                        }
                    });
                };

                return Promise;
            })();



        /**
         * @param {Function} handler
         * @param {Object} [context]
         * @returns {*}
         */
        Object.prototype.forEach = function (handler, context) {
            context = context || this;
            if (this.length)
                for (var i = 0; i < this.length; ++i)
                    handler.call(context, this[i], i);
            else {
                for (var i in this)
                    if (this.hasOwnProperty(i))
                        handler.call(context, this[i], i);
            }
            return this;
        };

        /**
         * @param {Function} handler
         * @param {Object} [context]
         * @returns {Array}
         */
        Object.prototype.map = function (handler, context) {
            var items = [];
            this.forEach(function (item, key) {
                items.push(handler.call(context, item, key));
            });
            return items;
        };

        /**
         * @param {Function} handler
         * @param {Object} [context]
         * @returns {Array}
         */
        Object.prototype.filter = function (handler, context) {
            var items = [];
            this.forEach(function (item, key) {
                if (handler.call(context, item, key))
                    items.push(item);
            });
            return items;
        };

        /**
         * @param {Function} handler
         * @param {*} [init]
         * @param {Object} [context]
         * @returns {*}
         */
        Object.prototype.reduce = function (handler, init, context) {
            var val = init;
            this.forEach(function (item, key) {
                val = handler.call(context, val, item, key);
            });
            return val;
        };

        /**
         * @param {Function} handler
         * @param {Object} [context]
         * @returns {Boolean}
         */
        Object.prototype.every = function (handler, context) {
            // Fullösning för att bryta ut ur loopen i förtid
            var Exception = {};
            try {
                this.forEach(function (item, key) {
                    if (!handler.call(context, item, key))
                        throw Exception;
                });
            } catch (e) {
                return false;
            }

            return true;
        };

        /**
         * @param otherItem
         * @returns {boolean}
         */
        Object.prototype.contains = function (otherItem) {
            if (Array.isArray(this))
                return this.indexOf(otherItem) > -1;

            var Exception = {};
            try {
                this.forEach(function (itemA) {
                    if (itemA === otherItem)
                        throw Exception;
                });
            } catch (e) {
                return true;
            }
            return false;
        };

        /**
         * @returns {Array}
         */
        Object.prototype.unique = function () {
            var items = [];
            this.forEach(function (item) {
                if (!items.contains(item))
                    items.push(item);
            });
            return items;
        };

        /**
         * @returns {Array}
         */
        Object.prototype.keys = function () {
            if (Object.keys)
                return Object.keys(this);
            else
                return this.map(function(value, key) { return key; });
        };

        /**
         * @param {(Object|*[])} obj
         * @returns {*}
         */
        Object.prototype.merge = function (obj) {
            if (Array.isArray(this) && Array.isArray(obj)) {
                obj.forEach(function (val) { if (!this.contains(val)) this.push(val); }, this);
                this.sort();
            }
            else if (typeof obj === 'object')
                obj.forEach(function (val, key) { this[key] = val; }, this);
            return this;
        };

        Object.prototype.union = function (obj) {
            var base = Array.isArray(this) ? [] : {};
            return base.merge(this).merge(obj);
        };

        Object.prototype.intersection = function (obj) {
            var base = Array.isArray(this) ? [] : {};
            var that = this;
            this.union(obj).forEach(function (val, key) {
                if (Array.isArray(that) && that.contains(val) && obj.contains(val))
                    base.push(val);
                else if (that.hasOwnProperty(key) && obj.hasOwnProperty(key))
                    base[key] = val;
            });
            return base;
        };

        Object.prototype.clone = function () {
            if (Array.isArray(this)) {
                var arr = [];
                [].push.apply(arr, this);
                return arr;
            }
            return {}.merge(this);
        };

        Object.prototype.equals = function (obj) {
            return this.every(function (val, key) { return obj[key] === val; });
        };

        Array.prototype.remove = function () {
            var that = this;
            arguments.forEach(function (item) {
                var i = that.indexOf(item);
                if (i > -1) that.splice(i, 1);
            });
            return that;
        };

        /**
         * @param {string} className
         */
        Element.prototype.addClass = function (className) {
            if (this.className.indexOf(className) === -1)
                this.className += ' ' + className;
        };

        /**
         * @param {string} className
         */
        Element.prototype.removeClass = function (className) {
            this.className = this.className.split(' ').filter(function (name) { return name !== className; }).join(' ');
        };

        // Gör om attribut till property och lyssna på förändringar
        if (!Object.prototype.watch) {
            Object.defineProperty(Object.prototype, 'watch', {
                enumerable: true,
                configurable: true,
                writable: false,
                value: function (prop, handler) {
                    var oldval = this[prop],
                        newval = oldval;
                    if (delete this[prop]) {
                        Object.defineProperty(this, prop, {
                            enumerable: true,
                            configurable: true,
                            get: function () { return newval; },
                            set: function (val) { oldval = newval; return newval = handler.call(this, prop, oldval, val) || val; }
                        });
                    }
                }
            });
        }

        /**
         * Returnerna en ny funktion som körs senare.
         * Om tiden är 0 så körs funktionen så fort stacken är tom
         * @param {number} time
         * @returns {Function}
         */
        Function.prototype.delay = function (time) {
            var f = this;
            return function () {
                var context = this;
                var args = arguments;
                setTimeout(function () { f.apply(context, args); }, time);
            };
        };

        Function.prototype.defer = function () { return this.delay(0); };

    })();


    /**
     * @class
     */
    var EventAggregator = (function () {

        /**
         * @constructs
         * @param {Object} [options]
         */
        function EventAggregator(options) {
            if (options && typeof options !== 'object') throw new TypeError('Options must be an object');

            if (options) this.merge(options);

            this._eventHandlers = {};
            this._requestHandlers = {};
            this.on('all', function () { console.log([this].concat([].slice.call(arguments))); })
        }

        /**
         * Bind en händelse till ett event
         * @param {string} event
         * @param {Function} handler
         */
        EventAggregator.prototype.on = function (event, handler) {
            if (typeof event !== 'string') throw new TypeError('Event name must be a string');
            if (typeof handler !== 'function') throw new TypeError('Handler must be a function');

            if (!this._eventHandlers[event]) this._eventHandlers[event] = [];
            this._eventHandlers[event].push(handler.bind(this));
        };

        /**
         * Ta bort alla händelser för ett event
         * @param {string} event
         * @param {Function} [handler]
         */
        EventAggregator.prototype.off = function (event, handler) {
            if (typeof event !== 'string') throw new TypeError('Event name must be a string');
            if (handler && typeof handler !== 'function') throw new TypeError('Handler must be a function');

            var events = (event === 'all') ? this._eventHandlers.keys() : this._eventHandlers[event] ? [event] : null;
            if (events === null) return;

            events.forEach(function (event) {
                if (!handler)
                    this._eventHandlers[event] = [];
                else {
                    do this._eventHandlers[event].remove(handler);
                    while (this._eventHandlers[event].contains(handler));
                }
                if (this._eventHandlers[event].length === 0)
                    delete this._eventHandlers[event];
            }, this)
        };

        EventAggregator.prototype.once = function (event, handler) {
            var that = this;
            var callback = function () {
                handler.apply(that, arguments);
                that.off(event, callback);
            };
            this.on(event, callback);
        };

        /**
         * Trigga alla händelser för ett event
         * @param {string} eventName
         * @param {...*} args
         */
        EventAggregator.prototype.trigger = function (eventName, args) {
            if (typeof eventName !== 'string') throw new TypeError('Event name must be a string');

            args = [].slice.call(arguments, 1);

            if (eventName !== 'all')
                this.trigger.apply(this, ['all', eventName].concat(args));

            var that = this, handlers = this._eventHandlers[eventName];
            if (handlers)
                handlers.forEach(function (handler) { handler.apply(that, args); }.defer());

            if (eventName !== 'all' && args.length >= 1 && (typeof args[0] === 'string' || typeof args[0] === 'number'))
                this.trigger.apply(this, [eventName + ':' + args[0]].concat(args.slice(1)));
        };

        /**
         * Sätt en svarsfunktion för en viss begäran
         * @param {string} requestName
         * @param {Function} handler
         */
        EventAggregator.prototype.setRequestHandler = function (requestName, handler) {
            if (typeof requestName !== 'string')
                throw new TypeError('requestName must be a string');
            if (typeof handler !== 'function')
                throw new TypeError('Request handler must be a function');
            this._requestHandlers[requestName] = handler.bind(this);
        };

        /**
         * Bäger en viss sak
         * @param {string} requestName
         * @param {*[]} args...
         * @returns {*}
         */
        EventAggregator.prototype.request = function (requestName, args) {
            args = [].slice.call(arguments, 1);

            if (!(requestName in this._requestHandlers))
                throw new Error('No handler set for request');

            return this._requestHandlers[requestName].apply(this, args);
        };

        return EventAggregator;

    })();

    /**
     * Gör att WebSockets blir enklare att arbeta med
     * @class
     * @extends {EventAggregator}
     */
    var Socket = (function (EventAggregator) {

        var TIMEOUT = 10000;

        /**
         * @param {string} url
         * @constructs
         */
        function Socket(url) {
            EventAggregator.call(this);

            this._socket = new WebSocket(url);
            this._socket.onopen = this.trigger.bind(this, 'open');
            this._socket.onerror = this.trigger.bind(this, 'raw', 'error');
            this._socket.onmessage = this.trigger.bind(this, 'raw', 'message');

            var that = this;

            this._waitUntilOpen = new Promise(function (resolve) {
                if (that._socket.readyState === 4)
                    resolve();
                else
                    that.on('open', resolve.bind(this));
            });

            this.on('raw:message', function (rawMessage) {
                try {
                    var message = JSON.parse(rawMessage.data);
                    that.trigger('message', message['event'], message['data'], message['id']);
                } catch (e) {
                    that.trigger('error', "Couldn't parse response");
                }
            });

            window.addEventListener('beforeunload', function () {
                that._socket.close();
            });
        }

        Socket.prototype = Object.create(EventAggregator.prototype);
        Socket.prototype.constructor = Socket;

        /**
         * Skicka ett meddelande till servern
         * Löftet uppfylls med svaret när det anländer eller nekas efter en timeout
         * @param {string} event
         * @param {Object} data
         * @returns {Promise}
         */
        Socket.prototype.send = function (event, data) {
            if (typeof event !== 'string') throw new TypeError('Event name must be a string');
            this.trigger('send', event, data);

            var that = this;
            return that._waitUntilOpen
                .then(function () {
                    return new Promise(function (resolve, reject) {
                        var id = Math.random().toString(36).substring(7);
                        that._socket.send(JSON.stringify({
                            'id': id,
                            'event': event,
                            'data': data
                        }));

                        var messageHandler = function (data, responseId) {
                            if (responseId === id) {
                                resolve(data);
                                clearTimeout(timeout);
                                that.off('message:' + event, messageHandler);
                            }
                        };

                        var timeout = setTimeout(function () {
                            reject();
                            that.off('message:' + event, messageHandler);
                        }.bind(this), TIMEOUT);

                        that.on('message:' + event, messageHandler);
                    });
                });
        };

        return Socket;

    })(EventAggregator);


    /**
     * @param {string} method
     * @param {string} url
     * @param {Object} [data]
     * @returns {Promise<Object>}
     */
    function AJAX(method, url, data) {
        if (typeof method !== 'string') throw new TypeError('HTTP method must be a string');
        method = method.toUpperCase();
        if (!['GET', 'POST', 'PUT', 'DELETE'].contains(method)) throw new Error('Incorrect HTTP method');
        if (typeof url !== 'string') throw new TypeError('URL must be a string');
        if (typeof data !== 'object') throw new TypeError('Data must be a key-value map (Object)');

        return new Promise(function (resolve, reject) {
            var XHR = new XMLHttpRequest;

            XHR.onload = function () {
                try {
                    resolve(JSON.parse(this.responseText));
                } catch (e) {
                    reject(e);
                }
            };

            var fd = null;
            if (method === 'GET')
                url += '?' + data.reduce(function (soFar, value, key) { return key + '=' + value + (soFar ? '&' + soFar : ''); });
            else {
                fd = new FormData;
                data.forEach(function (value, key) {
                    if (typeof value !== 'object')
                        fd.append(key.toString(), value);
                });
            }

            XHR.open(method, url, true);
            XHR.send(fd);
        })
    }


    /**
     * Representerar en mall som kan renderas med data
     * @class
     */
    var Template = (function() {

        /**
         * @param {string} text
         * @constructs
         * @public
         */
        function Template(text) {
            this.rawTemplate = text;
        }

        /**
         * @param {(Object|Function)} [data]
         * @returns {string}
         * @public
         */
        Template.prototype.render = function (data) {
            if (typeof data !== 'object' && typeof data !== 'function')
                throw new TypeError('Data must be either a function or an object');

            var model = typeof data === 'function' ? data() : typeof data === 'object' ? data : {};

            var text = this.rawTemplate;
            return text.replace(/{{\s*[^}]+\s*}}/g, function (match) {
                // Fulhack nivå 99
                // Kan inte eval:a kod i en specifik kontext, måste skapa och evaluera en funktion...
                // Ytterst tveksam säkerhet, en hel mängd spännande injections kan utnyttjas...
                try {
                    var result = new Function('with(this) { return ' + match.slice(2, -2) + '; }').call(model);
                    if (result) return result;
                } catch(e) {}
                return match;
            });

        };

        return Template;

    })();


    /**
     * Ett cachat objekt som skickar ut event när innehållet ändras
     * @class
     */
    var Model = (function (EventAggregator) {

        /**
         * @override
         * @constructs
         * @param {Object} [options]
         */
        function Model(options) {
            EventAggregator.call(this);
            if (options && typeof options !== 'object') throw new TypeError('Options must be an object');
            this.cache = {};
        }

        Model.prototype = Object.create(EventAggregator.prototype);
        Model.prototype.constructor = Model;

        /**
         * @param {string} prop
         * @returns {*}
         */
        Model.prototype.get = function(prop) {
            if (typeof prop !== 'string') throw new TypeError('Property name must be a string');

            return this.cache[prop];
        };

        /**
         * @param {(Object|string)} data
         * @param {*} [item]
         */
        Model.prototype.set = function(data, item) {
            if (typeof data !== 'object' && typeof data !== 'string')
                throw new TypeError('Data must either be an object or a string');

            switch (typeof data) {
                case 'string':
                    var obj = {};
                    obj[data] = item;
                    this.set(obj);
                    break;
                case 'object':
                    data.forEach(function (item, prop) {
                        this.trigger('set', prop, item);
                        if (item !== this.get(prop))
                            this.trigger('change', prop, item);
                        this.cache[prop] = item;
                    }.bind(this));
            }
        };

        /**
         * @param {string} prop
         */
        Model.prototype.remove = function(prop) {
            this.trigger('remove', prop, this.get(prop));
            delete this.cache[prop];
        };

        Model.prototype.toDict = function () { return this.cache.clone(); };

        return Model;

    })(EventAggregator);


    /**
     * Ett cachat objekt som också sparar mot localStorage
     * @class
     * @extends {Model}
     */
    var PersistentModel = (function (Model) {

        /**
         * @override
         * @constructs
         * @param {Object} [options]
         */
        function PersistentModel(options) {
            Model.call(this, options);
            options = options || {};

            if (options.prefix && typeof options.prefix !== 'string') throw new TypeError('Prefix must be a string');
            if (options.default && typeof options.default !== 'object') throw new TypeError('Default values must be an object');

            this.prefix = options.prefix ? options.prefix + ':' : '';
            this.default = options.default || {};
        }

        PersistentModel.prototype = Object.create(Model.prototype);
        PersistentModel.prototype.constructor = PersistentModel;

        /**
         * @override
         * @param {string} prop
         * @returns {*}
         */
        PersistentModel.prototype.get = function (prop) {
            var data = Model.prototype.get.call(this, prop);
            if (data === null || data === undefined)
                data = this.cache[prop] = JSON.parse(localStorage.getItem(this.prefix + prop));
            if (data === null || data === undefined && prop in this.default)
                data = this.cache[prop] = this.default[prop];
            return data;
        };

        /**
         * @override
         * @param {(string|Object)} data
         * @param {*} [item]
         */
        PersistentModel.prototype.set = function (data, item) {
            Model.prototype.set.call(this, data, item);

            if (typeof data === 'object')
                data.forEach(function (item, prop) {
                    localStorage.setItem(this.prefix + prop, JSON.stringify(item));
                }.bind(this));
        };

        /**
         * @override
         * @param {string} prop
         */
        PersistentModel.prototype.remove = function (prop) {
            Model.prototype.remove.call(this, prop);
            localStorage.removeItem(this.prefix + prop);
        };

        PersistentModel.prototype.sync = function () {
            this.cache.forEach(function (item, prop) {
                this.cache[prop] = JSON.parse(localStorage.getItem(this.prefix + prop));
            }.bind(this));
            this.trigger('sync');
        };

        return PersistentModel;

    })(Model);


    /**
     * En ordnad mängd av modeller
     * @class
     * @extends {EventAggregator}
     */
    var Collection = (function (EventAggregator) {

        /**
         * @override
         * @constructs
         * @param {Object} [options]
         */
        function Collection(options) {
            EventAggregator.call(this);
            options = options || {};

            this.merge(options);

            if (options.init && typeof options.init !== 'function')
                throw new TypeError('Initializer must be a function');

            if (options.ModelClass && !(new options.ModelClass instanceof Model))
                throw new TypeError('Not a Model');

            if (!this.ModelClass) this.ModelClass = Model;
            this.models = [];

            this.forEach = [].forEach.bind(this.models);
            //this.map = [].map.bind(this.models);
            //this.filter = [].filter.bind(this.models);

            var that = this;
            Object.defineProperty(this, 'length', {
               enumerable: true,
               get: function () { return that.size(); }
            });

            if (this.init) this.init.call(this);
        }

        Collection.prototype = Object.create(EventAggregator.prototype);
        Collection.prototype.constructor = Collection;

        /**
         * @param {(Model|Model[])} models
         * @param {Object} [options]
         */
        Collection.prototype.add = function (models, options) {
            if (!Array.isArray(models) && !(models instanceof this.ModelClass))
                throw new TypeError("Model must be instance of the collection's model");
            if (options && typeof options !== 'object')
                throw new TypeError('Options must be an object')

            options = options || {};
            models = Array.isArray(models) ? models : [models];

            if (options.replace) this.clear.call(this);

            if (options.append)
                [].push.apply(this.models, models);
            else
                [].unshift.apply(this.models, models);

            if (!options.silent && models.length > 0) {
                this.trigger('add', models);
                this.trigger('change');
            }
        };

        /**
         * @param {(Object|Object[])} objects
         * @param {Object} [options]
         */
        Collection.prototype.create = function (objects, options) {
            if (typeof objects !== 'object') throw new TypeError('Objects must be an object or array of objects');
            if (options && typeof options !== 'object') throw new TypeError('Options must be an object')

            options = options || {};

            objects = Array.isArray(objects) ? objects : [objects];
            var models = objects.map(function (data) {
                if (typeof data !== 'object') throw new TypeError('Object must be an object');

                var model = new this.ModelClass;
                model.set(data);
                return model;
            }.bind(this));

            if (!options.silent && models.length > 0)
                this.trigger('create', models);

            this.add.call(this, models, options);
        };

        /**
         * @param {(Model|Model[])} models
         */
        Collection.prototype.remove = function (models) {
            if (!Array.isArray(models) || !(models instanceof this.ModelClass)) throw new TypeError("Model must be instance of the collection's model");

            models = Array.isArray(models) ? models : [models];
            models.forEach(function (model) {
                if (!(model instanceof this.ModelClass)) throw new TypeError("Model must be instance of the collection's model");

                this.models.remove(model);
                model.trigger('remove', this);
            }.bind(this));
            this.trigger('remove', models);
            this.trigger('change');
        };

        Collection.prototype.clear = function () {
            this.trigger('remove', this.models.clone());
            this.trigger('change');
            this.models.remove.apply(this.models, this.models);
        };

        /**
         * @param {number} index
         * @returns {*}
         */
        Collection.prototype.get = function (index) {
            if (typeof index !== 'number') throw new TypeError('Index must be a number');
            if (index >= this.models.length) throw new RangeError('Index out of bounds');

            return this.models[index];
        };

        /**
         * @param {Object} conditions
         * @returns {Array}
         */
        Collection.prototype.where = function (conditions) {
            if (typeof conditions !== 'object') throw new TypeError('Conditions must be an object');
            return this.models.filter(function (model) {
                return conditions.every(function(val, key) {
                    return model[key] === val;
                });
            })
        };

        Collection.prototype.size = function () { return this.models.length; }

        return Collection;
    })(EventAggregator);


    /**
     * En komponent, som har en mall, en modell och ett element
     * @class
     * @extends {EventAggregator}
     */
    var Component = (function (EventAggregator) {

        /**
         * @param {Object} [options]
         * @constructor
         * @public
         */
        function Component(options) {
            EventAggregator.call(this);
            options = options || {};

            if (options && typeof options !== 'object')
                throw new TypeError('Options must be an object');

            if (options.init && typeof options.init !== 'function')
                throw new TypeError('Initializer must be a function');

            this.model = {};
            this.tagName = 'div';
            this.template = '';
            this.events = {};

            this.encapsulate = true;

            this.merge(options);

            if (options && options.element)
                this.element = options.element;
            else {
                this.element = document.createElement(this.tagName);
                if (this.className) this.element.className = this.className;
                if (this.id) this.element.id = this.id;
            }

            if (this.init)
                this.init.call(this);
        }

        Component.prototype = Object.create(EventAggregator.prototype);
        Component.prototype.constructor = Component;

        /**
         * @param {Component} component
         * @private
         */
        function bindEvents (component) {
            if (!(component instanceof Component)) throw new TypeError('Not a component');

            component.events.forEach(function (handler, selector) {
                var opts = selector.split(' ');
                var elements = (opts.length === 1)
                    ? [component.element]
                    : [].slice.call(component.element.querySelectorAll(opts[0]));
                var events = (opts.length <= 1) ? opts : opts.slice(1);
                elements.forEach(function (element) {
                    events.forEach(function (event) {
                        element.addEventListener(event, handler, false);
                    });
                });
            });
        }

        /**
         * @param {Object} [options]
         * @returns {string}
         * @public
         */
        Component.prototype.render = function (options) {
            if (options && typeof options !== 'object') throw new TypeError('Options must be an object');

            this.merge(options);
            if (typeof this.template === 'string' && !(this.template instanceof Template))
                this.template = new Template(this.template);

            var html = (typeof this.template === 'function') ? this.template(this.model) : this.template.render(this.model);

            this.element.innerHTML = html;

            bindEvents(this);
            return html;
        };

        /**
         * @param {Node} targetNode
         * @param {Node} sourceNode
         * @param {Boolean} [includeRootNode]
         * @public
         * @static
         */
        Component.moveChildNodes = function (targetNode, sourceNode, includeRootNode) {
            if (!(targetNode instanceof Node)) throw new TypeError('Incorrect target element');
            if (!(sourceNode instanceof Node)) throw new TypeError('Incorrect source element');

            if (includeRootNode)
                targetNode.appendChild(sourceNode);
            else
                while (sourceNode.cloneNode(true).hasChildNodes())
                    targetNode.appendChild(sourceNode.firstChild);
        };

        return Component;

    })(EventAggregator);


    /**
     * En mängd komponenter
     * @class
     * @extends {Component}
     */
    var CollectionComponent = (function (Component) {

        /**
         * @param {Object} [options]
         * @constructor
         * @public
         */
        function CollectionComponent(options) {
            Component.call(this, options);
            this.merge(options);

            if (options.models && !Array.isArray(options.models) && !options.models instanceof Collection)
                throw new TypeError('Components must be a colletion');

            if (options.ComponentClass && !(new options.ComponentClass instanceof Component))
                throw new TypeError('ComponentClass must be a subclass of Component');

            if (options.components && !Array.isArray(options.components))
                throw new TypeError('Component list must be an array');

            function xor(a, b) { return !a != !b; }
            if (xor(options.models, options.ComponentClass))
                throw new SyntaxError('Must supply both a collection and a ComponentClass');

            //if (!xor(options.ComponentClass, options.components))
            //    throw new SyntaxError('Must supply either a list of components or a collection and a ComponentClass');

            if (Array.isArray(options.models)) {
                this.models = new Collection;
                this.models.create(options.models);
            }

            if (this.models)
                this.models.on('change', this.render.bind(this));
        }

        CollectionComponent.prototype = Object.create(Component.prototype);
        CollectionComponent.prototype.constructor = CollectionComponent;

        /**
         * @param {Object} [options]
         * @override
         * @public
         */
        CollectionComponent.prototype.render = function (options) {
            Component.prototype.render.call(this, options);

            // console.log([this, 'rendered']);

            if (this.models)
                this.components = this.models
                    .map(function (model) {
                        return new this.ComponentClass({ model: model.toDict() });
                    }, this);

            this.components.forEach(function (component) {
                if (!(component instanceof Component)) throw new TypeError('Not a component');
                component.render();
                Component.moveChildNodes(this.element, component.element, component.encapsulate);
            }, this);
        };

        return CollectionComponent;

    })(Component);


    /**
     * Renderar subkomponenter enligt css-selektorer
     * @class
     * @extends {Component}
     */
    var Composite = (function (Component) {

        /**
         * @param {Object} [options]
         * @constructor
         * @public
         */
        function Composite (options) {
            Component.call(this, options);

            this.components = {};
            this.merge(options);
        }

        Composite.prototype = Object.create(Component.prototype);
        Composite.prototype.constructor = Composite;

        /**
         * @param {Object} [options]
         * @override
         * @public
         */
        Composite.prototype.render = function (options) {
            Component.prototype.render.call(this, options);
            this.components.forEach(function (component, selector) {
                component.render();
                Component.moveChildNodes(this.element.querySelector(selector), component.element, true);
            }, this);
        };

        return Composite;

    })(Component);


    /**
     * Visar och gömmer en komponent
     * @class
     * @extends {EventAggregator}
     */
    var Region = (function (EventAggregator) {

        /**
         * @param {Object} [options]
         * @constructor
         * @public
         */
        function Region(options) {
            EventAggregator.call(this);

            if (options && typeof options !== 'object') throw new TypeError('Options must be an object');

            this.merge(options);
            var _element = this.element;
            Object.defineProperty(this, 'element', {
                get: function () {
                    if (!_element)
                        _element = document.createElement('div');
                    else if (typeof _element === 'string')
                        _element = document.querySelector(_element);
                    return _element;
                },
                set: function (el) { _element = el; }
            })
        }

        Region.prototype = Object.create(EventAggregator.prototype);
        Region.prototype.constructor = Region;

        /**
         * @public
         */
        Region.prototype.close = function () {
            this.element.innerHTML = '';
        };

        /**
         * @param {Component} component
         * @param {boolean} [doRender=true]
         * @public
         */
        Region.prototype.show = function (component, doRender) {
            if (!(component instanceof Component)) throw new TypeError('Not a component');
            if (doRender !== undefined && doRender !== null && typeof doRender !== 'boolean') throw new TypeError('Flag must be boolean');

            this.close();
            if (doRender || doRender !== undefined || doRender !== null) component.render();

            Component.moveChildNodes(this.element, component.element, component.encapsulate);
        };

        return Region;

    })(EventAggregator);


    /**
     * Lyssnar på ändringar i location.hash och anropar olika rutt-metoder
     * @class
     * @extends {EventAggregator}
     */
    var Router = (function (EventAggregator) {

        /**
         * @param {Object} [options]
         * @constructor
         * @public
         */
        function Router(options) {
            EventAggregator.call(this);

            this.routes = {};
            this.merge(options);

            /** @private */
            this._ignoreNextHashChange = false;
        }

        Router.prototype = Object.create(EventAggregator.prototype);
        Router.prototype.constructor = Router;

        Router.prototype.start = function () {
            this.navigate(window.location.hash);
            window.addEventListener('hashchange', function () {
                if (this._ignoreNextHashChange === false)
                    this.navigate(window.location.hash);
                this._ignoreNextHashChange = false;
            }.bind(this));
        };

        /**
         * @param {string} hash
         * @private
         */
        Router.prototype.setHash = function (hash) {
            if (typeof hash !== 'string') throw new TypeError('Hash must be a string');

            // Ändra bara om det behövs.
            // 'hashchange'-eventet triggas inte om
            // slutresultatet är detsamma.
            if (window.location.hash.slice(1) !== (hash[0] === '#' ? hash.slice(1) : hash)) {
                this._ignoreNextHashChange = true;
                window.location.hash = hash;
            }
        };

        /**
         * Rutten 'profile/5' anropar handlern för 'profile/:id' med parametern '5'
         * @param {string} hash
         * @public
         */
        Router.prototype.navigate = function (hash) {
            if (typeof hash !== 'string') throw new TypeError('Incorrect hash');

            hash = hash.toLowerCase();

            if (hash.charAt(0) === '#') hash = hash.slice(1);

            // Dela upp url:en i 'chunks'
            var chunkRegex = /([_\-.@:\w]+(?=\/)|[_\-.@:\w]+$)/g;
            var hashChunks = hash.split(chunkRegex);

            // Fix för att känna igen om url:en slutar på /
            hashChunks[hashChunks.length-1] = '';

            var routeChunks, argumentMask, match = false;
            this.routes.forEach(function (handler, route) {
                // Kan inte avbryta iteratorn, måste testa om vi är klara
                if (!match) {
                    routeChunks = route.toLowerCase().split(chunkRegex);
                    if (hashChunks.length === routeChunks.length) {
                        argumentMask = routeChunks.map(function (chunk) { return chunk.charAt(0) === ':'; });
                        // Matcha element mot varandra, förutom då elementet är ett argument
                        if (match = hashChunks.every(function (chunk, i) { return argumentMask[i] || chunk === routeChunks[i]; })) {
                            if (typeof handler === 'string')
                                this.navigate(handler);
                            else {
                                handler.apply(this, hashChunks.filter(function (chunk, i) { return argumentMask[i]; }));
                                this.setHash(hash);
                                this.trigger('route', hash);
                            }
                        }
                    }
                }
            }, this);

            // Om ingen match, gå till roten om den finns
            if (!match && this.routes['']) this.navigate('');
        }.defer();

        return Router;

    })(EventAggregator);


    return {
        EventAggregator: EventAggregator,

        AJAX: AJAX,
        Socket: Socket,
        Promise: window.Promise,

        Model: Model,
        PersistentModel: PersistentModel,
        Collection: Collection,

        Template: Template,
        Component: Component,
        CollectionComponent: CollectionComponent,
        Composite: Composite,
        Region: Region,
        Router: Router
    };

})();