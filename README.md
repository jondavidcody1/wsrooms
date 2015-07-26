wsrooms
=======

A [Gorilla WebSocket](https://github.com/gorilla/websocket) implementation with support for rooms/channels.

### Getting Started
- **wsrooms(url)** - connect to a wsrooms WebSocket server at *url* and return a root instance

### Root Instance Methods
- **.send(event, payload, dst)** - send *payload* of type *event* to *dst*; if *dst* is not specified or an invalid peer id then broadcast to all connected peers
- **.join(room)** - join *room* and return a room instance
- **.leave()** - disconnect from the WebSocket server
- **.purge()** - leave all rooms except the root room

### Room Instance Methods
- **.send(event, payload, dst)** - send *payload* of type *event* to *dst*; if *dst* is not specified or an invalid peer id then broadcast to all peers within this room
- **.leave()** - leave this room

### Utility Methods
When sending data, *payload* is always converted to an ArrayBuffer.  In order to parse this data, the following utility methods come in handy:
- **wsrooms.getStringFromCodes(array)** - get a string from *array* of character codes
- **wsrooms.getCodesFromString(string)** - get an array of character codes from *string*

### Server Example
```go
package main

import (
    "github.com/gojonnygo/wsrooms"
    "html/template"
    "net/http"
    "log"
)

var index = template.Must(template.ParseFiles("index.html"))

func indexHandler(w http.ResponseWriter, r *http.Request) {
    index.Execute(w, nil)
}

func staticHandler(w http.ResponseWriter, r *http.Request) {
    http.ServeFile(w, r, r.URL.Path[1:])
}

func main() {
    wsrooms.Emitter.On("hello", func (conn *wsrooms.Conn, data []byte, msg *wsrooms.Message) {
        log.Println(msg)
    })
    http.HandleFunc("/", indexHandler)
    http.HandleFunc("/static/", staticHandler)
    http.HandleFunc("/ws", wsrooms.SocketHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

### Client Example
```js
var socket = wsrooms('ws://localhost:8080/ws');

socket.on('open', function () {
    var room = socket.join('myroom');

    console.log('Socket opened.');
    room.on('joined', function (peerid) {
        console.log(peerid);
    });
    room.on('left', function (peerid) {
        console.log(peerid);
    });
    room.on('hello', function (data) {
        console.log(JSON.parse(wsrooms.getStringFromCodes(data)));
    });
    socket.send('hello', 'world!');
    room.send('hello', {hello: 'world!'});
});
socket.on('joined', function (peerid) {
    console.log(peerid);
});
socket.on('left', function (peerid) {
    console.log(peerid);
});
socket.on('close', function () {
    console.log('Socket closed.');
});
socket.on('error', function (err) {
    console.log('Socket error: ', err);
});
socket.on('hello', function (data) {
    console.log(wsrooms.getStringFromCodes(data));
});
```
