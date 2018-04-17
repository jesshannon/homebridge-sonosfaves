/// <reference path="SonosBase.ts"/>

class SonosClip extends SonosBase {

  uri:string;
  volume:number;

  constructor(log:Object, config: Object){
    super(log,config);
    this.uri = config["uri"];
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
    if(player==null)
    {
      this.log.warn("Ignoring request; Sonos device has not yet been discovered.");
      callback(new Error("Sonos has not been discovered yet."));
      return;
    }

    callback(null, player.state.currentTrack.uri == this.uri);
    return;
  }


  setOn(on:Boolean, callback:Function) {

    var player = SonosBase.players[this.player];
    if(player==null)
    {
      this.log.warn("Ignoring request; Sonos device has not yet been discovered.");
      callback(new Error("Sonos has not been discovered yet."));
      return;
    }

    if(on)
    {
      // switch on

      singlePlayerAnnouncement(player, this.uri, this.volume);
      callback(null);

    }
    else {
      // switch off

      //this.log("Stopping playback on " + this.player);

      //player.coordinator.pause();
      callback(null);

    }

  }

}

const backupPresets = {};

function singlePlayerAnnouncement(player, uri, volume) {
// Create backup preset to restore this player
  const state = player.state;
  const system = player.system;

  let groupToRejoin;

  const backupPreset = {
    players: [
      { roomName: player.roomName, volume: state.volume }
    ]
  };

  if (player.coordinator.uuid == player.uuid) {
    // This one is coordinator, you will need to rejoin
    // remember which group you were part of.
    const group = system.zones.find(zone => zone.coordinator.uuid === player.coordinator.uuid);
    if (group.members.length > 1) {
      console.log('Think its coordinator, will find uri later');
      groupToRejoin = group.id;
      backupPreset.group = group.id;
    } else {
      // was stand-alone, so keep state
      backupPreset.state = state.playbackState;
      backupPreset.uri = player.avTransportUri;
      backupPreset.metadata = player.avTransportUriMetadata;
      backupPreset.playMode = {
        repeat: state.playMode.repeat
      };

      if (!isRadioOrLineIn(backupPreset.uri)) {
        backupPreset.trackNo = state.trackNo;
        backupPreset.elapsedTime = state.elapsedTime;
      }

    }
  } else {
    // Was grouped, so we use the group uri here directly.
    backupPreset.uri = `x-rincon:${player.coordinator.uuid}`;
  }

  console.log('backup state was', backupPreset);

// Use the preset action to play the tts file
  var ttsPreset = {
    players: [
      { roomName: player.roomName, volume }
    ],
    playMode: {
      repeat: false
    },
    uri
  };

  let announceFinished;
  let afterPlayingStateChange;
  let abortTimer;

  const onTransportChange = (state) => {
    // Short circuit if this announcement has been finished.
    if (!announceFinished) {
      return;
    }
    console.log(`playback state switched to ${state.playbackState}`);
    // if (state.playbackState !== 'STOPPED') {
    //   player.once('transport-state', onTransportChange);
    // }

    if (state.playbackState === 'STOPPED' && afterPlayingStateChange instanceof Function) {
      console.log('announcement finished because of STOPPED state identified');
      afterPlayingStateChange();
      afterPlayingStateChange = undefined;
      return;
    }

    if (state.playbackState === 'PLAYING') {
      afterPlayingStateChange = announceFinished;
    }

    const abortDelay = 1;//player._state.currentTrack.duration + 2;
    clearTimeout(abortTimer);
    console.log(`Setting restore timer for ${abortDelay} seconds`);
    abortTimer = setTimeout(() => {
      console.log(`Restoring backup preset because ${abortDelay} seconds passed`);
      if (announceFinished instanceof Function) {
        announceFinished();
      }
    }, abortDelay * 1000);

    // This is some odd scenario where STOPPED is emitted when starting playback for some reason.
    player.once('transport-state', onTransportChange);
  };

  if (!backupPresets[player.roomName]) {
    backupPresets[player.roomName] = [];
  }

  backupPresets[player.roomName].unshift(backupPreset);
  console.log('backup presets array', backupPresets[player.roomName]);

  const prepareBackupPreset = () => {
    if (backupPresets[player.roomName].length > 1) {
      backupPresets[player.roomName].shift();
      console.log('more than 1 backup presets during prepare', backupPresets[player.roomName]);
      return Promise.resolve();
    }

    if (backupPresets[player.roomName].length < 1) {
      return Promise.resolve();
    }

    const relevantBackupPreset = backupPresets[player.roomName][0];

    console.log('exactly 1 preset left', relevantBackupPreset);

    if (relevantBackupPreset.group) {
      const zone = system.zones.find(zone => zone.id === relevantBackupPreset.group);
      if (zone) {
        relevantBackupPreset.uri = `x-rincon:${zone.uuid}`;
      }
    }

    console.log('applying preset', relevantBackupPreset);
    return system.applyPreset(relevantBackupPreset)
      .then(() => {
        backupPresets[player.roomName].shift();
        console.log('after backup preset applied', backupPresets[player.roomName]);
      });
  }

  return system.applyPreset(ttsPreset)
    .then(() => {
      // Remove any lingering event listener before attaching a new one
      player.once('transport-state', onTransportChange);
      return new Promise((resolve) => {
        announceFinished = resolve;
      });
    })
    .then(() => {
      clearTimeout(abortTimer);
      announceFinished = undefined;
      // player.removeListener('transport-state', onTransportChange);
    })
    .then(prepareBackupPreset)
    .catch((err) => {
      //logger.error(err);
      // player.removeListener('transport-state', onTransportChange);
      return prepareBackupPreset()
        .then(() => {
          // we still want to inform that stuff broke
          throw err;
        });
    });
}


function isRadioOrLineIn(uri) {
  return uri.startsWith('x-sonosapi-stream:') ||
    uri.startsWith('x-sonosapi-radio:') ||
    uri.startsWith('pndrradio:') ||
    uri.startsWith('x-sonosapi-hls:') ||
    uri.startsWith('x-rincon-stream:') ||
    uri.startsWith('x-sonos-htastream:') ||
    uri.startsWith('x-sonosprog-http:') ||
    uri.startsWith('x-rincon-mp3radio:');
}