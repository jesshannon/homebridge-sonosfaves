const SonosSystem = require('sonos-discovery');
const path = require('path');

abstract class SonosBase {
    
    log: Object;
    config: Object;
    name: string;
    player: string;
    service: Object;

    static players:{[name:string]: Object; } = {};
    static discovery:SonosSystem;

    constructor(log:Object, config:Object) {
        
        this.log = log;
        this.config = config;
        this.name = config["name"];
        this.player = config["player"];

        this.setupCharacteristic();

        SonosBase.discovery = new SonosSystem({
            port: 5005,
            securePort: 5006,
            cacheDir: path.resolve(__dirname, 'cache'),
            webroot: path.resolve(__dirname, 'static'),
            presetDir: path.resolve(__dirname, 'presets'),
            announceVolume: 40
        });

        SonosBase.discovery.on('transport-state', function (player) {
            SonosBase.players[player.roomName] = player;
        });
        
    }

    abstract setupCharacteristic()

    getServices() : Array<Object> {
        return [this.service]
    }


}




