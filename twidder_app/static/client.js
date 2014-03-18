var App = function (API) {
    'use strict';

    if (!(API instanceof Connector))
        throw new TypeError('API must be an instance of Connector');

   //API.on('all', function () { if (arguments[0].indexOf(':') === -1) console.log([this].concat([].slice.call(arguments))); });

    var appCache = new Framework.PersistentModel({
        prefix: 'twidder_cache',

        // Default values:
        default: {
            email: {},
            userdata: {}
        }
    });

    var _mainRegion, _welcomeView, _profileView, _cachedUserViews = [];

    /**
     * Huvudrouter, styr vilka effekter olika rutter ska ha
     * @type {Framework.Router}
     */
    var router = new Framework.Router({
        routes: {
            // root
            '': 'welcome',

            // @welcome
            'welcome': function () {
                if (API.isLoggedIn()) { this.navigate('profile'); return; }
                if (!_welcomeView) _welcomeView = new WelcomeView;
                setTitleSuffix();
                _mainRegion.show(_welcomeView);
            },

            // @profile
            'profile': 'profile/home',

            // @profile/[sektion]
            'profile/:dest': function (dest) {
                if (!API.isLoggedIn()) { this.navigate('welcome'); return; }
                if (!_profileView) _profileView = new ProfileView;
                _profileView.switchTab(dest);
                var user = appCache.get('userdata')[appCache.get('user')];
                setTitleSuffix(user['firstname'] + ' ' + user['familyname']);
                _mainRegion.show(_profileView);
            },

            'profile/browse/:email': function (userEmail) {
                if (!API.isLoggedIn()) { this.navigate('welcome'); return; }
                if (!_profileView) _profileView = new ProfileView;
                _profileView.switchTab('browse');
                _mainRegion.show(_profileView);
                _profileView.panels['browse'].showUser(userEmail);
            }
        }
    });

    API.on('session:signin', router.navigate.bind(router, 'profile'));
    API.on('session:signout', function () {
        router.navigate('');
        _profileView = null;
    });

    API.on('navigate', router.navigate.bind(router));
    API.setRequestHandler('cache', function () { return appCache; });

    /**
     * @param {string} [prefix]
     */
    function setTitleSuffix(prefix) {
        document.title = "Twidder" + ((prefix) ? ' - ' + prefix : '');
    }


    // Hjälpfunktioner för validering
    function resetStyle(element) { ['valid', 'invalid'].forEach(function (c) { element.removeClass(c); }); }
    function setValid(element) { resetStyle(element); element.addClass('valid'); }
    function setInvalid(element) { resetStyle(element); element.addClass('invalid'); }

    function isEmpty(element) { return element.value.length === 0; }
    function isEmail(element) { return element.value.match(/^[\w.-]+@[\w.-]+.\D+$/) !== null; }
    function isEqualToSiblingElementValue(sibling) { return function (el) { return el.value === el.form[sibling].value; } }
    function isValid(tests) { return function (el) { return tests[el.name](el); }; }
    function isTestable(tests) { return function (el) { return el.name && typeof tests[el.name] === 'function'; }; }

    function not(f) { return function () { return !f.apply(null, arguments); };  }
    function and() {
        var functions = arguments;
        return function () {
            var args = arguments;
            return functions.every(function (f) {
                return f.apply(null, args);
            });
        };
    }

    /**
     * Välkomstvyn, med inloggning och signUp
     * @extends {Framework.Composite}
     * @constructor
     */
    var WelcomeView = function () {
        return new Framework.Composite({
            encapsulate: false,

            template: document.getElementById('WelcomeView').innerHTML,

            events: (function () {

                // Testfunktioner för olika element
                var _tests = {
                    'email':      isEmail,
                    'password':   not(isEmpty),
                    'confirm':    and(not(isEmpty), isEqualToSiblingElementValue('password')),
                    'firstname':  not(isEmpty),
                    'familyname': not(isEmpty),
                    'city':       not(isEmpty),
                    'country':    not(isEmpty)
                };

                return {
                    'form submit': function (event) {
                        event.preventDefault();

                        var inputs = [].slice.call(this).filter(isTestable(_tests));
                        inputs.forEach(resetStyle);

                        var invalidInputs = inputs.filter(not(isValid(_tests)));
                        invalidInputs.forEach(setInvalid);

                        if (invalidInputs.length === 0) {
                            switch (this.id) {
                            case 'loginForm' :
                                API.signIn(this['email'].value, this['password'].value)
                                    .catch(function (message) {
                                        this.filter(isTestable(_tests)).forEach(setInvalid);
                                        this.querySelector('.errorMessage').textContent = message;
                                    }.bind(this));
                                break;
                            case 'signupForm' :
                                API.signUp({
                                    'email':      this['email'].value,
                                    'password':   this['password'].value,
                                    'firstname':  this['firstname'].value,
                                    'familyname': this['familyname'].value,
                                    'gender':     this['gender'].value,
                                    'city':       this['city'].value,
                                    'country':    this['country'].value
                                })
                                    .catch(function (message) {
                                        this.filter(isTestable(_tests)).forEach(setInvalid);
                                        this.querySelector('.errorMessage').textContent = message;
                                    }.bind(this));
                            }
                        }
                    },

                    'input focus': function() { resetStyle(this); },

                    'input blur': function () {
                        if (isTestable(_tests)(this)) {
                            if (isValid(_tests)(this))
                                setValid(this);
                            else
                                setInvalid(this);
                        }
                    }
                }
            })()
        });
    };

    /**
     * En användarvy
     * @param {Object} model
     * @extends {Framework.Composite}
     * @constructor
     */
    var UserView = function (model) {
        var component = new Framework.Composite({
            encapsulate: false,
            template: document.getElementById('UserView').innerHTML,
            model: model,
            components: {

                /**
                 * En lista med alla meddelanden
                 * @type {Framework.CollectionComponent}
                 */
                '#wallPosts': new Framework.CollectionComponent({
                    encapsulate: true,

                    // Kommer bytas ut så fort modellerna kommer in
                    components: [new Framework.Component({
                        encapsulate: true,
                        className: 'filler',
                        template: '<div class="progress"></div>'
                    })],

                    ComponentClass: (function (Component) {
                        var _template = document.getElementById('WallPost').innerHTML;
                        function WallpostComponent(options) {
                            Component.call(this, (options || {}).merge({
                                encapsulate: true,
                                className: 'wallpost',
                                template: _template
                            }));
                        }
                        WallpostComponent.prototype = new Component;
                        return WallpostComponent;
                    })(Framework.Component),

                    models: new Framework.Collection({

                        ModelClass: (function (Model) {
                            function WallpostModel(options) {
                                Model.call(this, options);
                            }
                            WallpostModel.prototype = new Model;
                            WallpostModel.prototype.set = function (data, item) {
                                if (typeof data === 'object' && 'content' in data)
                                    ({
                                        '<': '&lt;',
                                        '>': '&gt;',
                                        '\n': '<br>'
                                    }).forEach(function (val, key) {
                                        data['content'] = data['content'].replace(new RegExp(key, 'gi'), val);
                                    });
                                Model.prototype.set.call(this, data, item);
                            };
                            return WallpostModel;
                        })(Framework.Model),

                        init: function () {
                            //this.on('all', function () { console.log([this].concat([].slice.call(arguments))); });

                            // Lyssna på meddelande-event från API:t för den användare vyn är förknippad med
                            API.on('messages:send:' + model['email'], this.create.bind(this));
                            API.on('messages:recieve:' + model['email'], this.create.bind(this));
                            API.on('messages:clear:' + model['email'], this.clear.bind(this));
                        }
                    })

                })
            },

            events: {
                'form submit': function (event) {
                    event.preventDefault();
                    var element = this['message'];
                    setInvalid(element);
                    if (!isEmpty(element)) {
                        setValid(element);
                        API.postMessage(element.value, component.model['email']);
                        element.value = "";
                    }
                },
                'textarea focus': function() { resetStyle(this); },
                'textarea blur': function () {
                    if (!isEmpty(this))
                        setValid(this);
                    else
                        setInvalid(this);
                },
                '#refreshPosts click': function () {
                    API.getUserMessagesForUser(component.model['email']);
                }
            }
        });

        API.getUserMessagesForUser(component.model['email']);

        return component;
    };

    /**
     * Browse-panelen, listar andra användare
     * @extends {Framework.Composite}
     * @constructor
     */
    var BrowseView = function () {

        this.showUser = function (email) {
            var showMe = function (user) {
                setTitleSuffix(user['firstname'] + ' ' + user['familyname']);
                composite.components['#userProfile'] = (function () {
                    var email = user['email'];
                    if (!(email in _cachedUserViews))
                        _cachedUserViews[email] = new UserView(user);
                    return _cachedUserViews[email];
                })();
                composite.render();
            };

            if (email in appCache.get('userdata'))
                showMe(appCache.get('userdata')[email]);
            else {
                API.getUserDataForUser(email)
                    .then(function (userdata) {
                        var cache = appCache.get('userdata');
                        cache[email] = userdata;
                        appCache.set('userdata', cache);
                        showMe(userdata);
                    });
            }
        };

        var composite = new Framework.Composite({
            template: document.getElementById('BrowseView').innerHTML,
            events: {
                'form submit': function (event) {
                    event.preventDefault();
                    router.navigate('profile/browse/' + this['email'].value);
                }
            }
        });

        return composite.merge(this);
    };

    /**
     * Kontopanelen, med möjlighet att ändra lösenord
     * @extends {Framework.Component}
     * @constructor
     */
    var AccountView = function () {
        return new Framework.Component({
            template: document.getElementById('AccountView').innerHTML,
            encapsulate: false,
            events: (function () {
                var _tests = {
                    'old_password': not(isEmpty),
                    'new_password': and(not(isEmpty), isEqualToSiblingElementValue('confirm')),
                    'confirm':      and(not(isEmpty), isEqualToSiblingElementValue('new_password'))
                };
                return {
                    'form submit': function (event) {
                        event.preventDefault();
                        var invalidInputs = this
                            .filter(isTestable(_tests))
                            .forEach(resetStyle)
                            .filter(not(isValid(_tests)))
                            .forEach(setInvalid);
                        if (invalidInputs.length === 0) {
                            API.changePassword(this['old_password'].value, this['new_password'].value)
                                .then(function (response) {
                                    this.querySelector('.errorMessage').textContent = response['message'];
                                    if (response['success'] === false)
                                        this.filter(isTestable(_tests)).forEach(setInvalid);
                                }.bind(this));
                        }
                    },
                    'input focus': function() { resetStyle(this); },
                    'input blur': function () {
                        if (isTestable(this)) {
                            if (isValid(this))
                                setValid(this);
                            else
                                setInvalid(this);
                        }
                    }
                }
            })()
        });
    };

    /**
     * Profilvyn, med tabbgränssnitt
     * @extends {Framework.Composite}
     * @constructor
     */
    var ProfileView = function () {

        this.panels = {
            'home': new UserView(appCache.get('userdata')[appCache.get('user')]),
            'browse': new BrowseView,
            'account': new AccountView
        };

        var that = this;


        var composite = new Framework.Composite({
            template: document.getElementById('ProfileView').innerHTML,
            encapsulate: false,
            model: appCache.get('userdata')[appCache.get('user')],
            currentTabName: 'home',

            switchTab: function (name) {
                name = name.toLowerCase();
                if (name in that.panels) {
                    this.currentTabName = name;
                }
            },

            // Här definierar vi med css-selektorer vad som ska hamna i mallen
            components: {

                /**
                 * Tabbpanelen, som innehåller tabbarna
                 * @type {Framework.CollectionComponent}
                 */
                '#tabs': new Framework.CollectionComponent({
                    encapsulate: false,
                    components: that.panels.map(function (component, name) {
                        return new Framework.Component({
                            encapsulate: false,
                            template: function () {
                                return '<div class="tab' + (composite.currentTabName === name ? ' selected' : '') + '">' + name + '</div>';
                            },
                            events: {
                                '.tab click': function () { router.navigate('profile/' + name); }
                            }
                        });
                    })
                }),

                /**
                 * Huvudregionen där innehållet från de olika tabbarna ska hamna
                 * @type {Framework.Region}
                 */
                '#pv_content': new Framework.Region({
                    // If it quacks like a duck, I say it's a duck
                    render: function () {
                        if (composite.currentTabName !== name)
                            this.show(that.panels[composite.currentTabName]);
                    }
                })
            },

            events: { '#logout click': function () { API.signOut(); } }

        });

        return composite.merge(this);
    };


    this.start = function () {
        _mainRegion = new Framework.Region({ element: '#content' });
        router.start();
    };
};


window.onload = function () {
    (new App(new WebSocketConnector)).start();
};