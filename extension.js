
const St = imports.gi.St;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;

function debug_log(text) {
    log('[PwmClient-DEBUG] ' + text);
}

const RPC_URL = 'http://192.168.0.200:8081/rpc';

const PwmClient = new Lang.Class({
    Name: 'PwmClient',
    Extends: PanelMenu.Button,

    _init: function () {
        this.parent(0.0, "PwmClient", false);

        this.buttonText = new St.Label({
            text: 'text ',
            y_align: Clutter.ActorAlign.CENTER
        });

        this.actor.add_actor(this.buttonText);
        
        this._loadStatus();
    },

    _loadStatus: function() {
        debug_log('Loading Status');
        
        let params = {
            cmd: 'status',
        };
        var _httpSession = new Soup.Session()
        let message =   Soup.form_request_new_from_hash('POST', RPC_URL, params);
        _httpSession.queue_message(message, Lang.bind(this, function (_httpSession, message) {
                debug_log('HTTP Status: ' + message.status_code);
                if (message.status_code !== 200) {
                    return;
                }
                let json = JSON.parse(message.response_body.data);
                debug_log('HTTP data: ' + JSON.stringify(json));
            }
          )
        );
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
