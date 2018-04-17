/// <reference path="node-0.12.d.ts" />
/// <reference path="SonosBase.ts"/>
/// <reference path="SonosPlaylist.ts"/>
/// <reference path="SonosClip.ts"/>

const SonosSystem = require('sonos-discovery');
const path = require('path');

var Service, Characteristic;
var sonosAccessories = [];

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory("homebridge-sonosfaves", "SonosPlaylist", SonosPlaylist);
  homebridge.registerAccessory("homebridge-sonosfaves", "SonosClip", SonosClip);

}
