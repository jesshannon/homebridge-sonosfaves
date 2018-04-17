/// <reference path="SonosBase.ts"/>

class SonosPlaylist extends SonosBase {

  playlist:string;
  volume:number;

  constructor(log:Object, config: Object){
    super(log,config);
    this.playlist = config["playlist"];
    this.volume = config["volume"];
  }

  setupCharacteristic(){
        this.service = new Service.Switch(this.name);

        this.service
            .getCharacteristic(Characteristic.On)
            .on('get', this.getOn.bind(this))
            .on('set', this.setOn.bind(this));
  }

  getOn(callback:Function)
  {
    
    var player = SonosBase.players[this.player];

    callback(null, player.state.playbackState == "PLAYING");
    return;
  }


  setOn(on:Boolean, callback:Function) {

    var player = SonosBase.players[this.player];

    if(on)
    {
      // switch on

      this.log("Starting playlist "+this.playlist+" on " + this.player);

      player.coordinator
          .replaceWithPlaylist(this.playlist)
          .then(
            () => {
              player.coordinator.shuffle(true); // switch on shuffle
              player.coordinator.nextTrack(); // skip to a shuffled track
              player.coordinator.repeat("all"); // 
              player.coordinator.setVolume(this.volume);
              player.coordinator.play();
              callback(null);
            }
          );
    }
    else {
      // switch off

      this.log("Stopping playback on " + this.player);

      player.coordinator.pause();
      callback(null);

    }


  }

}