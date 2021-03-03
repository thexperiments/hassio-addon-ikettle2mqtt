# HASSIO iKettle2mqtt 
HASSIO addon to connect iKettle electric kettle to homeassistant via MQTT
* make sure to configure before start
* kettle should be auto discovered
* don't change unique id after the fact, it will create new autodiscovered enteties

> [!CAUTION]
> If autodiscovery was used make sure to delete/overwrite the discovery topics.
Then restart Homeassistant and you should be able to delete them in the "entities" view.

todo:
* Add coffe stuff?