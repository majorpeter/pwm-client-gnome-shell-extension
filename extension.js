
const St = imports.gi.St;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;

function debug_log(text) {
    log('[PwmClient-DEBUG] ' + text);
}

const RPC_URL = 'http://192.168.0.200:8081/rpc';

const PwmClient = new Lang.Class({
    Name: 'PwmClient',
    Extends: PanelMenu.Button,

    _lightEnabled: false,
    _sliderR: null,
    _sliderG: null,
    _sliderB: null,
    _sliderBr: null,

    _init: function () {
        this.parent(0.0, "PwmClient", false);

        this.buttonText = new St.Label({
            text: 'Lighting',
            y_align: Clutter.ActorAlign.CENTER
        });

        this.actor.add_actor(this.buttonText);

        this._sliderR = new SliderWithIcon('R', 0);
        this._sliderG = new SliderWithIcon('G', 0);
        this._sliderB = new SliderWithIcon('B', 0);
        this._sliderBr = new SliderWithIcon('Br', 1);

        this._sliderR._connectOnChange(Lang.bind(this, this._setColorFromSliders));
        this._sliderG._connectOnChange(Lang.bind(this, this._setColorFromSliders));
        this._sliderB._connectOnChange(Lang.bind(this, this._setColorFromSliders));
        this._sliderBr._connectOnChange(Lang.bind(this, this._setBrightnessFromSlider));

        this.menu.addMenuItem(this._sliderR);
        this.menu.addMenuItem(this._sliderG);
        this.menu.addMenuItem(this._sliderB);
        this.menu.addMenuItem(this._sliderBr);

        let toggleMenuItem = new PopupMenu.PopupMenuItem(_('Toggle'));
        toggleMenuItem.connect('activate', Lang.bind(this, this._toggle));
        this.menu.addMenuItem(toggleMenuItem);
        
        this._loadStatus();
    },

    _loadStatus: function() {
        debug_log('Loading Status');
        
        var _httpSession = new Soup.Session();
        let message =   Soup.form_request_new_from_hash('POST', RPC_URL, {
            cmd: 'status',
        });
        _httpSession.queue_message(message, Lang.bind(this, function (_httpSession, message) {
                if (message.status_code !== 200) {
                    debug_log('HTTP Error: ' + message.status_code);
                    return;
                }
                let json = JSON.parse(message.response_body.data);
                debug_log('HTTP data: ' + JSON.stringify(json));

                this._lightEnabled = (json.status == 'on');

                this._sliderR._setValue(json.red / 255);
                this._sliderG._setValue(json.green / 255);
                this._sliderB._setValue(json.blue / 255);
                
                this._sliderBr._setValue(json.brightness / 100);
            }
          )
        );
    },

    _setColorFromSliders: function() {
        let byteR = Math.floor(this._sliderR._getValue() * 255);
        let byteG = Math.floor(this._sliderG._getValue() * 255);
        let byteB = Math.floor(this._sliderB._getValue() * 255);
        debug_log('Setting color: ' + byteR + ', ' + byteG + ', ' + byteB);

        var _httpSession = new Soup.Session();
        let message = Soup.form_request_new_from_hash('POST', RPC_URL, {
            cmd: 'setcolor',
            red: String(byteR),
            green: String(byteG),
            blue: String(byteB),
        });
        _httpSession.queue_message(message, Lang.bind(this, function (_httpSession, message) {
                if (message.status_code !== 200) {
                    debug_log('HTTP Error: ' + message.status_code);
                }
            }
          )
        );
    },

    _setBrightnessFromSlider: function() {
        let brightness = Math.floor(this._sliderBr._getValue() * 100);
        debug_log('Setting brightness: ' + brightness);

        var _httpSession = new Soup.Session();
        let message = Soup.form_request_new_from_hash('POST', RPC_URL, {
            cmd: 'setbrightness',
            b: String(brightness),
        });
        _httpSession.queue_message(message, Lang.bind(this, function (_httpSession, message) {
                if (message.status_code !== 200) {
                    debug_log('HTTP Error: ' + message.status_code);
                }
            }
          )
        );
    },

    _toggle: function() {
        let command = 'default';
        if (this._lightEnabled) {
            command = 'off';
        }
        debug_log('Toggle (cmd = ' + command + ')');
        var _httpSession = new Soup.Session();
        let message =   Soup.form_request_new_from_hash('POST', RPC_URL, {
            cmd: command,
        });
        _httpSession.queue_message(message, Lang.bind(this, function (_httpSession, message) {
                if (message.status_code !== 200) {
                    debug_log('HTTP Error: ' + message.status_code);
                    return;
                }
                this._lightEnabled = !this._lightEnabled;
            }
          )
        );
    }
});

const SliderWithIcon = new Lang.Class({
    Name: 'SliderWithIcon',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(title, initialValue) {
        this.parent();

        //TODO icon instead
        this._text = new St.Label({
            text: title,
            y_align: Clutter.ActorAlign.CENTER
        });
        // fun fact: this initial value argument takes a number between 0-100, but _value is between 0-1.0
        this._slider = new Slider.Slider(0);
        this._slider._value = initialValue;

        this.actor.add(this._text);
        this.actor.add(this._slider.actor, {expand: true});
    },

    _getValue: function() {
        return this._slider._value;
    },

    _setValue: function(value) {
        this._slider._value = value;
    },

    _connectOnChange: function(callback) {
        this._slider.connect('value-changed', callback);
    }
});

let pwmClientMenu;

function init() {
}

function enable() {
    pwmClientMenu = new PwmClient;
    Main.panel.addToStatusArea('pwmclient-indicator', pwmClientMenu);
}

function disable() {
    //TODO stop
    pwmClientMenu.destroy();
}
