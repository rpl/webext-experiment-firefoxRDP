## "Firefox Remote Debugging Protocol" webextension experiment

This project contains a webextension experiment which provides a simple WebExtensions API
to directly interact with the Remote Debugging Protocol.

IMPORTANT:

This API is not meant to be a part of the regular WebExtensions APIs (mainly because by exposing the full RDP protocol it can be easily used to escape the sandboxing model of the WebExtensions APIs).

The real goal of this webextension experiment is to provide an easy way to design new WebExtensions devtools APIs by temporarely building them on top of the API provided by this experiment, without creating an experiment addon for every one of the APIs that we want to explore.

Once an WebExtension devtools-oriented APIs has been designed using this approach, it should be rewritten as its own webextension experiment or directly as a new official API as part of the mozilla-central repo.

## Using this experimental API in 4 simple steps

1. Run a Firefox DevEdition or Nightly (with version >=51) and navigate to [about:debugging](about:debugging)
2. Choose "Load Temporary Add-on" and select (a file from) the
   `experiment/` directory in this project.  You should see
   a new entry in the list of extensions titled "Experimental API".
3. Choose "Load Temporary Add-on" and select (a file from) the
   `extension/` directory in this project.  You should see a new entry
   in the list of extensions titled "hello test".
4. Open the Browser Console to check that the expected log messages have been produced by the RDP connection created by the test extension background page
5. Open a new tab to an arbitrary http/https URL, open the developer tools on the tab, and check in the Browser Console that the expected log messages have been produced by the RDP connection created by the devtools page
6. Navigate the tab on a different URL, and check in the Browser Console that the expected log messages have been produced

## browser.experiments.firefoxRDP API

Inside the `browser.experiments.firefoxRDP` API namespace, there are 2 events and 6 methods:

### Methods

#### browser.experiments.firefoxRDP.connect

```
browser.experiments.firefoxRDP.connect(targetURL)
       .then(([rdpConnectionId, rdpTargetForm, rdpTargetTraits]) => {...});
```

Given a target URL (e.g. "http://fake.devtools.domain?type=process" is going to connect to the main process of the debugging server of the Firefox instance the experiments is running on, more info about the syntax: http://searchfox.org/mozilla-central/rev/90d1cbb4fd3dc249cdc11fe5c3e0394d22d9c680/devtools/client/framework/target-from-url.js#12-46), `connect` returns:

- a numeric connection id (which can be used in the other API method to interact with an opened RDP connection)
- an object with the target form (which contains the RDP actor ids and other informations related to the target)
- and object with the target server traits (which can be used for discovery the feature supported by the connected remote debugging server).

The target URL can be omitted if the experiment API is used from a devtools page or a devtools panel, and the current target of the developer toolbox is going to be connected.

#### browser.experiments.firefoxRDP.disconnect

```
browser.experiments.firefoxRDP.disconnect(connId).then(successCb, failureCb);
```

Disconnect an opened RDP connection given the connection id returned by the connect method
(the connectionId can be omitted when the experiment API is used from a devtools page or a devtools panel).

#### browser.experiments.firefoxRDP.getTargetInfo

```
browser.experiments.firefoxRDP.getTargetInfo(connId).then(([form, traits]) => {...});
```

Get the target form and the connection traits given the connection id
(the connectionId can be omitted when the experiment API is used from a devtools page or a devtools panel).


#### browser.experiments.firefoxRDP.sendRequest

```
browser.experiments.firefoxRDP.sendRequest(connId, actorId, requestType, requestProperties)
       .then((res) => {...});
```

Send an RDP request on an opened RDP connection, given the connection id, the actor id, the request type and the properties of the request
(the connectionId can be omitted when the experiment API is used from a devtools page or a devtools panel).

#### browser.experiments.firefoxRDP.subscribeEvents

```
browser.experiments.firefoxRDP.subscribeEvents(connId, [eventName1, eventName2, ...])
       .then((res) => {...});
```

Subscribe an array of unsolicited RDP event names
(the connectionId can be omitted when the experiment API is used from a devtools page or a devtools panel).

#### browser.experiments.firefoxRDP.unbscribeEvents

```
browser.experiments.firefoxRDP.unsubscribeEvents(connId, [eventName1, eventName2, ...])
       .then((res) => {...});
```

Unsubscribe an array of unsolicited RDP event names.
(the connectionId can be omitted when the experiment API is used from a devtools page or a devtools panel).

### Events

#### browser.experiments.firefoxRDP.onDisconnected

```
browser.experiments.firefoxRDP.onDisconnected.addListener((connId) => {...});
```

The onDisconnected event is fired when a RDP connection is closed.

#### browser.experiments.firefoxRDP.onRDPEvent

```
browser.experiments.firefoxRDP.onRDPEvent.addListener((connId, eventName, eventData) => {...});
```

The onRDPEvent event is fired when an unsolicited RDP event has been received.
