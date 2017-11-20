
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

    _init: function () {
        this.parent(0.0, "PwmClient", false);

        this.buttonText = new St.Label({
            text: 'Lighting',
            y_align: Clutter.ActorAlign.CENTER
        });

        this.actor.add_actor(this.buttonText);

        this.menu.addMenuItem(new SliderWithIcon());

        let toggleMenuItem = new PopupMenu.PopupMenuItem(_('Toggle'));
        toggleMenuItem.connect('activate', Lang.bind(this, this._toggle));
        this.menu.addMenuItem(toggleMenuItem);
        
        this._loadStatus();
    },

    _loadStatus: function() {
        debug_log('Loading Status');
        
        var _httpSession = new Soup.Session()
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
        var _httpSession = new Soup.Session()
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

    _init: function(params) {
        this.parent(params);

        //TODO icon
        this._slider = new Slider.Slider(0);
        this.actor.add(this._slider.actor, {expand: true});
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
