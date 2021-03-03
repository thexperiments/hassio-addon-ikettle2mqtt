var mqtt=require('mqtt');
var Promise = require('bluebird');
var iKettle = require('smarter-devices-promise').iKettle;
var fs = require('fs');

var hassio_options = {}

if(fs.existsSync('/data/options.json')){
  hassio_options = JSON.parse(fs.readFileSync('/data/options.json', 'utf8'));
  console.log("loaded hassio config...");
}
else if (fs.existsSync('./dev_options.json')){
  hassio_options = JSON.parse(fs.readFileSync('./dev_options.json', 'utf8'));
  console.log("loaded develepment config...");
}
else {
  console.log("no config found! Please configure in hassio or provide dev_options.json identical to hassio conifig section.");
  process.exit(1);
}

var dicoveryPrefix = hassio_options.discoveryPrefix || "homeassistant";
var mqttServer = hassio_options.mqttHost || "localhost";

var host = hassio_options.kettleIP;
var kettleName = hassio_options.kettleName;
var uniqueKettleID = hassio_options.kettleUniqueID;
var heatingTo = 0;

//Check if enough data to actually start up
if (host === "your_ip_here" || kettleName === "" || uniqueKettleID === "" || mqttServer === ""){
  console.log("Not enough configuration to start, please check configuration.");
  process.exit(1);
}

var mqttOptions={
  clientId:"iKettle2mqtt",
  clean:true};

if (hassio_options.mqttUser !== ""){
  mqttOptions.username = hassio_options.mqttUser;
  mqttOptions.password = hassio_options.mqttPassword;
}

var client = mqtt.connect("mqtt://" + mqttServer,mqttOptions);

var myKettle = new iKettle(host);
console.log("Connecting to kettle " + host);
myKettle.connect().then(function(){
  console.log("Connected to kettle " + host);
  if(hassio_options.discoveryEnabled == true){
    var messageOptions = {
          retain:true,
          qos:1};
    //basic config
    var config = {
      "name": kettleName,
      "unique_id": uniqueKettleID,
      "payload_off": "stopHeating",
      "payload_on": "startHeating",
      "state_off": "off",
      "state_on": "on",
      "command_topic": `iKettle/${uniqueKettleID}/command`,
      "state_topic": `iKettle/${uniqueKettleID}/heating`,
      "icon": "mdi:kettle",
    }
    console.log("Publishing homeassistant auto discovery " + JSON.stringify(config));
    client.publish(dicoveryPrefix + "/switch/iKettle_" + uniqueKettleID + "/config",JSON.stringify(config), messageOptions);
    //temperature configs
    hassio_options.additionalTemperatures.forEach(element => {
      var tempConfig = {
        "name": kettleName + " "  + element,
        "unique_id": uniqueKettleID + element,
        "payload_off": "stopHeating",
        "payload_on": "startHeatingCustom:" + element,
        "state_off": "0",
        "state_on": `${element}`,
        "command_topic": `iKettle/${uniqueKettleID}/command`,
        "state_topic": `iKettle/${uniqueKettleID}/heatingTo`,
        "icon": "mdi:kettle",
      }
      client.publish(dicoveryPrefix + "/switch/iKettle_" + uniqueKettleID + element +"/config",JSON.stringify(tempConfig), messageOptions);
      console.log("Publishing homeassistant auto discovery " + JSON.stringify(tempConfig));
    });
    //sensor config
    var tempSensorConfig = {
      "name": kettleName + " temperature",
      "unique_id": uniqueKettleID + "_temperature",
      "state_topic": `iKettle/${uniqueKettleID}/temperature`,
      "unit_of_measurement": "°C",
      "device_class":"temperature"
    }
    console.log("Publishing homeassistant auto discovery " + JSON.stringify(tempSensorConfig));
    client.publish(dicoveryPrefix + "/sensor/iKettle_" + uniqueKettleID + "_temperature/config",JSON.stringify(tempSensorConfig), messageOptions);

    var baseSensorConfig = {
      "name": kettleName + " on base",
      "unique_id": uniqueKettleID + "_base",
      "state_topic": `iKettle/${uniqueKettleID}/onBase`,
      "payload_off": "false",
      "payload_on": "true"
    }
    console.log("Publishing homeassistant auto discovery " + JSON.stringify(baseSensorConfig));
    client.publish(dicoveryPrefix + "/binary_sensor/iKettle_" + uniqueKettleID + "_base/config",JSON.stringify(baseSensorConfig, messageOptions));
  }
});

myKettle.on("statusMessage",function(status){
  console.log("Status:" + JSON.stringify(status));
  if (client.connected == true){
    if (!status.heating) heatingTo = 0;
    client.publish(`iKettle/${uniqueKettleID}/heating`, status.heating ? "on":"off");
    client.publish(`iKettle/${uniqueKettleID}/heatingTo`, `${heatingTo}`);
    client.publish(`iKettle/${uniqueKettleID}/status`,JSON.stringify(status));
    client.publish(`iKettle/${uniqueKettleID}/temperature`, `${status.temperature}`);
    client.publish(`iKettle/${uniqueKettleID}/onBase`, status.onBase ? "true":"false");
  }
})

client.on("connect",function(){	
  console.log("connected");
});

//handle incoming messages
client.on('message',function(topic, message, packet){
	console.log("message is "+ message);
	console.log("topic is "+ topic);
  if (topic === "iKettle/" + uniqueKettleID + "/command"){
    var commands = String(message).split(":");
    var command = commands[0];
    var temperature = parseInt(commands[1]|| 100);
    var keepWarmTime = parseInt(commands[2] || 0);
    console.log("Command:" + command);
    switch (String(command)) {
      case 'startHeating':
        return myKettle.startHeating();
        break;
      case 'stopHeating':
        return myKettle.stopHeating();
        break;
      case 'startHeatingCustom':
        heatingTo = temperature;
        return myKettle.startHeatingCustom(temperature,keepWarmTime);
        break;
      case 'status':
        return myKettle.getInfo();
        break;
      default:
        return Promise.reject("unknown command");
        break;
    }
  }
});

//handle errors
client.on("error",function(error){
  console.log("Can't connect" + error);
  process.exit(1)
});

client.subscribe("iKettle/" + uniqueKettleID + "/command",{qos:1});