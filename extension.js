
const St = imports.gi.St;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Util = imports.misc.util;

function debug_log(text) {
    log('[PwmClient-DEBUG] ' + text);
}

const SERVER_URL = 'http://192.168.0.200:5000';

const PwmClient = new Lang.Class({
    Name: 'PwmClient',
    Extends: PanelMenu.Button,

    _lightEnabled: false,
    _sliderR: null,
    _sliderG: null,
    _sliderB: null,
    _toggleAnimationTime: 0.5,
    _lastOnState: {'r': 0, 'g': 0, 'b': 0},
    _rgb_colors: null,
    _relative_brightness: 0,

    _init: function () {
        this.parent(0.0, "PwmClient", false);

        this.buttonText = new St.Label({
            text: 'Lighting',
            y_align: Clutter.ActorAlign.CENTER
        });

        this.actor.add_actor(this.buttonText);

        this._sliderR = new SliderWithIcon('', 'background:red', 0);
        this._sliderG = new SliderWithIcon('', 'background:green', 0);
        this._sliderB = new SliderWithIcon('', 'background:blue', 0);

        this._sliderR._connectOnChange(Lang.bind(this, this._onSliderVaueChanged));
        this._sliderG._connectOnChange(Lang.bind(this, this._onSliderVaueChanged));
        this._sliderB._connectOnChange(Lang.bind(this, this._onSliderVaueChanged));

        this._sliderR._connectIconClick(Lang.bind(this, this._sliderIconClicked, this._sliderR));
        this._sliderG._connectIconClick(Lang.bind(this, this._sliderIconClicked, this._sliderG));
        this._sliderB._connectIconClick(Lang.bind(this, this._sliderIconClicked, this._sliderB));

        this.menu.addMenuItem(this._sliderR);
        this.menu.addMenuItem(this._sliderG);
        this.menu.addMenuItem(this._sliderB);

        let toggleMenuItem = new PopupMenu.PopupMenuItem(_('Toggle'));
        toggleMenuItem.connect('activate', Lang.bind(this, this._toggle));
        this.menu.addMenuItem(toggleMenuItem);

        let openWebsiteMenuItem = new PopupMenu.PopupMenuItem(_('Open website'));
        openWebsiteMenuItem.connect('activate', Lang.bind(this, this._openWebsite));
        this.menu.addMenuItem(openWebsiteMenuItem);

        this.menu.connect('open-state-changed', Lang.bind(this, function(menu, open) {
            if (open) {
                this._loadStatus();
            }
        }));

        this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

        // load current status at the end of initialization
        this._loadStatus();
    },

    // Override PanelMenu.Button._onEvent
    _onEvent: function(actor, event) {
        if (this._onButtonEvent(actor, event) == Clutter.EVENT_PROPAGATE) {
            this.parent(actor, event);
        }
    },

    _onButtonEvent: function(actor, event) {
        if (event.type() == Clutter.EventType.BUTTON_PRESS) {
          let button = event.get_button();
          //debug_log('Button event: ' + button);
          if (button == 2) {
            this._toggle();
            return Clutter.EVENT_STOP;
          }
        }
        return Clutter.EVENT_PROPAGATE;
    },

    _onScrollEvent: function(actor, event) {
        switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
            this._changeBrightness(1);
            break;
        case Clutter.ScrollDirection.DOWN:
            this._changeBrightness(-1);
            break;
        }
    },

    _loadStatus: function() {
        debug_log('Loading Status');

        var _httpSession = new Soup.Session();
        let message =   Soup.form_request_new_from_hash('GET', SERVER_URL + '/led', {});
        _httpSession.queue_message(message, Lang.bind(this, function (_httpSession, message) {
                if (message.status_code !== 200) {
                    debug_log('HTTP Error: ' + message.status_code);
                    return;
                }
                let json = JSON.parse(message.response_body.data);
                debug_log('HTTP data: ' + JSON.stringify(json));

                this._rgb_colors = json.rgb.split(',');
                this._lightEnabled = (this._rgb_colors[0] > 0) ||
                                     (this._rgb_colors[1] > 0) ||
                                     (this._rgb_colors[2] > 0);

                this._sliderR._setValue(this._rgb_colors[0] / 255);
                this._sliderG._setValue(this._rgb_colors[1] / 255);
                this._sliderB._setValue(this._rgb_colors[2] / 255);
            }
          )
        );
    },

    _sendRgbColors: function(colors, animationTime) {
        let rgb_string = colors[0] + ',' + colors[1] + ',' + colors[2];
        debug_log('Setting color: ' + rgb_string);

        var _httpSession = new Soup.Session();
        let argument = {
            rgb: rgb_string
        };
        if (animationTime) {
            argument['animate'] = String(animationTime)
        }
        let message = Soup.form_request_new_from_hash('POST', SERVER_URL + '/led', argument);
        _httpSession.queue_message(message, Lang.bind(this, function (_httpSession, message) {
                if (message.status_code !== 200) {
                    debug_log('HTTP Error: ' + message.status_code);
                    return;
                }

                this._lightEnabled = (colors[0] > 0) ||
                                     (colors[1] > 0) ||
                                     (colors[2] > 0);
            }
          )
        );
    },

    _sendSliderValues: function(animationTime) {
        this._rgb_colors = [
            Math.floor(this._sliderR._getValue() * 255),
            Math.floor(this._sliderG._getValue() * 255),
            Math.floor(this._sliderB._getValue() * 255)
        ];
        this._relative_brightness = 0;

        this._sendRgbColors(this._rgb_colors, animationTime);
    },

    _onSliderVaueChanged: function(sender, value) {
        this._sendSliderValues();
    },

    _sliderIconClicked: function(event, arg1, slider) {
        let value = slider._getValue();
        if (value != 0) {
            slider._setValue(0);
        } else {
            slider._setValue(1);
        }
        this._sendSliderValues(this._toggleAnimationTime);
    },

    _toggle: function() {
        if (this._lightEnabled) {
            // save current values first
            this._lastOnState.r = this._sliderR._getValue();
            this._lastOnState.g = this._sliderG._getValue();
            this._lastOnState.b = this._sliderB._getValue();

            // send command
            this._sendRgbColors([0, 0, 0], this._toggleAnimationTime);

            // clear slider values (suppose the command was successful)
            this._sliderR._setValue(0);
            this._sliderG._setValue(0);
            this._sliderB._setValue(0);
        } else {
            // send command
            this._sendRgbColors([
                Math.floor(this._lastOnState.r * 255),
                Math.floor(this._lastOnState.g * 255),
                Math.floor(this._lastOnState.b * 255),
            ], this._toggleAnimationTime);

            // restore slider values
            this._sliderR._setValue(this._lastOnState.r);
            this._sliderG._setValue(this._lastOnState.g);
            this._sliderB._setValue(this._lastOnState.b);
        }
    },

    _changeBrightness: function(delta) {
        var BRIGHTNESS_QUOTIENT = 1.25;
        var CHANNEL_MAX = 255;

        this._relative_brightness += delta;

        var corrected_rgb_values = this._rgb_colors.slice();
        for (i in corrected_rgb_values) {
            if (corrected_rgb_values[i] == 0) {
                corrected_rgb_values[i] = 0.5;
            }
            corrected_rgb_values[i] = Math.round(Math.pow(BRIGHTNESS_QUOTIENT, this._relative_brightness) * corrected_rgb_values[i]);
            if (corrected_rgb_values[i] > CHANNEL_MAX) {
                corrected_rgb_values[i] = CHANNEL_MAX;
            }
        }

        this._sliderR._setValue(corrected_rgb_values[0] / 255);
        this._sliderG._setValue(corrected_rgb_values[1] / 255);
        this._sliderB._setValue(corrected_rgb_values[2] / 255);

        this._sendRgbColors(corrected_rgb_values);
    },

    _openWebsite: function() {
        Util.spawn(['xdg-open', SERVER_URL]);
    }
});

const SliderWithIcon = new Lang.Class({
    Name: 'SliderWithIcon',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(title, style_css, initialValue) {
        this.parent();

        this._icon = new St.Button({
            label: title,
            style_class: 'slider-icon',
            style: style_css,
        });
        // fun fact: this initial value argument takes a number between 0-100, but _value is between 0-1.0
        this._slider = new Slider.Slider(0);
        this._slider._value = initialValue;

        this.actor.add(this._icon);
        this.actor.add(this._slider.actor, {expand: true});
    },

    _getValue: function() {
        return this._slider._value;
    },

    _setValue: function(value) {
        this._slider.setValue(value);
    },

    _connectOnChange: function(callback) {
        this._slider.connect('value-changed', callback);
    },

    _connectIconClick: function(callback) {
        this._icon.connect('clicked', callback);
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
