//    Title: emitter.js
//    Author: Jon Cody
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.



(function (global) {
    'use strict';


    function emitter(object) {
        object = object && typeof object === 'object'
            ? object
            : {};
        object.events = {};
        object.addListener = function (type, listener) {
            var list = object.events[type];

            if (typeof listener === 'function') {
                if (object.events.newListener) {
                    object.emit('newListener', type, typeof listener.listener === 'function'
                        ? listener.listener
                        : listener);
                }
                if (!list) {
                    object.events[type] = [listener];
                } else {
                    object.events[type].push(listener);
                }
            }
            return object;
        };
        object.on = object.addListener;

        object.once = function (type, listener) {
            function g() {
                object.removeListener(type, g);
                listener.apply(object);
            }
            if (typeof listener === 'function') {
                g.listener = listener;
                object.on(type, g);
            }
            return object;
        };

        object.removeListener = function (type, listener) {
            var list = object.events[type],
                position = -1,
                i;

            if (typeof listener === 'function' && list) {
                for (i = list.length - 1; i >= 0; i -= 1) {
                    if (list[i] === listener || (list[i].listener && list[i].listener === listener)) {
                        position = i;
                        break;
                    }
                }
                if (position >= 0) {
                    if (list.length === 1) {
                        delete object.events[type];
                    } else {
                        list.splice(position, 1);
                    }
                    if (object.events.removeListener) {
                        object.emit('removeListener', type, listener);
                    }
                }
            }
            return object;
        };
        object.off = object.removeListener;

        object.removeAllListeners = function (type) {
            var list,
                i;

            if (!object.events.removeListener) {
                if (!type) {
                    object.events = {};
                } else {
                    delete object.events[type];
                }
            } else if (!type) {
                Object.keys(object.events).forEach(function (key) {
                    if (key !== 'removeListener') {
                        object.removeAllListeners(key);
                    }
                });
                object.removeAllListeners('removeListener');
                object.events = {};
            } else {
                list = object.events[type];
                for (i = list.length - 1; i >= 0; i -= 1) {
                    object.removeListener(type, list[i]);
                }
                delete object.events[type];
            }
            return object;
        };

        object.listeners = function (type) {
            var list = [];

            if (type) {
                if (object.events[type]) {
                    list = object.events[type];
                }
            } else {
                Object.keys(object.events).forEach(function (key) {
                    list.push(object.events[key]);
                });
            }
            return list;
        };

        object.emit = function (type) {
            var list = object.events[type],
                bool = false,
                args = [],
                length,
                i;

            if (list) {
                length = arguments.length;
                for (i = 1; i < length; i += 1) {
                    args[i - 1] = arguments[i];
                }
                length = list.length;
                for (i = 0; i < length; i += 1) {
                    list[i].apply(object, args);
                }
                bool = true;
            }
            return bool;
        };

        return object;
    }


    global.emitter = emitter;


}(window || this));



//    Title: wsrooms.js
//    Author: Jon Cody
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.



(function (global) {
    'use strict';


    function isTypedArray(array) {
        var arrayTypes = [
                'Int8Array',
                'Uint8Array',
                'Uint8ClampedArray',
                'Int16Array',
                'Uint16Array',
                'Int32Array',
                'Uint32Array',
                'Float32Array',
                'Float64Array'
            ],
            type = Object.prototype.toString.call(array).replace(/\[object\s(\w+)\]/, '$1');

        if (arrayTypes.indexOf(type) > -1) {
            return true;
        }
        return false;
    }


    function getCodesFromString(string) {
        var len = string.length,
            codes = [],
            x;

        for (x = 0; x < len; x += 1) {
            codes[x] = string.charCodeAt(x) & 0xff;
        }
        return codes;
    }


    function getStringFromCodes(codes) {
        var string = '',
            x;

        for (x = 0; x < codes.length; x += 1) {
            string += String.fromCharCode(codes[x]);
        }
        return string;
    }


    function WSRooms(url) {
        if (!global.WebSocket) {
            throw new Error('WebSocket is not supported by this browser.');
        }
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid WebSocket url.');
        }
        emitter(this);
        this.open = false;
        this.id = null;
        this.room = 'root';
        this.members = [];
        this.queue = [];
        this.rooms = {};
        this.socket = new WebSocket(url);
        this.socket.binaryType = 'arraybuffer';
        this.socket.addEventListener('message', this.onmessage.bind(this), false);
        this.socket.addEventListener('close', this.onclose.bind(this), false);
        this.socket.addEventListener('error', this.onerror.bind(this), false);
    }


    WSRooms.prototype.send = function (event, payload, dst) {
        var offset = 0,
            data,
            room,
            src;

        if (typeof event !== 'string') {
            throw new Error('Invalid parameters.');
        }
        if (!this.open && this.room === 'root') {
            this.queue.push([event, payload, dst]);
            return;
        }
        room = this.room;
        dst = dst || '';
        src = this.id;
        if (typeof payload !== 'string' && !(payload instanceof ArrayBuffer || isTypedArray(payload))) {
            payload = JSON.stringify(payload);
        }
        data = new DataView(new ArrayBuffer(room.length + event.length + dst.length + src.length + (payload.length || payload.byteLength || 0) + 20));
        data.setUint32(offset, room.length);
        offset += 4;
        (new Uint8Array(data.buffer)).set(getCodesFromString(room), offset);
        offset += room.length;
        data.setUint32(offset, event.length);
        offset += 4;
        (new Uint8Array(data.buffer)).set(getCodesFromString(event), offset);
        offset += event.length;
        data.setUint32(offset, dst.length);
        offset += 4;
        (new Uint8Array(data.buffer)).set(getCodesFromString(dst), offset);
        offset += dst.length;
        data.setUint32(offset, src.length);
        offset += 4;
        (new Uint8Array(data.buffer)).set(getCodesFromString(src), offset);
        offset += src.length;
        data.setUint32(offset, payload.byteLength || payload.length || 0);
        offset += 4;
        if (typeof payload === 'string') {
            (new Uint8Array(data.buffer)).set(getCodesFromString(payload), offset);
        } else {
            (new Uint8Array(data.buffer)).set(isTypedArray(payload) || Array.isArray(payload)
                ? payload
                : new Uint8Array(payload), offset);
        }
        this.socket.send(data.buffer);
    };


    WSRooms.prototype.onmessage = function (e) {
        var roomObj = this,
            data = new DataView(e.data),
            offset = 0,
            index,
            room,
            event,
            dst,
            src,
            payload;

        room = getStringFromCodes(new Uint8Array(data.buffer, offset + 4, data.getUint32(offset)));
        offset += 4 + room.length;
        event = getStringFromCodes(new Uint8Array(data.buffer, offset + 4, data.getUint32(offset)));
        offset += 4 + event.length;
        dst = getStringFromCodes(new Uint8Array(data.buffer, offset + 4, data.getUint32(offset)));
        offset += 4 + dst.length;
        src = getStringFromCodes(new Uint8Array(data.buffer, offset + 4, data.getUint32(offset)));
        offset += 4 + src.length;
        payload = new Uint8Array(data.buffer, offset + 4, data.getUint32(offset));
        if (room !== 'root' && !this.rooms.hasOwnProperty(room)) {
            throw new Error("Not in room " + room);
        }
        if (room !== 'root') {
            roomObj = this.rooms[room];
        }
        switch (event) {
        case 'join':
            roomObj.id = src;
            roomObj.members = JSON.parse(getStringFromCodes(payload));
            roomObj.open = true;
            roomObj.emit('open');
            roomObj.send('joined', src);
            if (roomObj.room === 'root') {
                while (roomObj.queue.length > 0) {
                    roomObj.send.apply(roomObj, roomObj.queue.shift());
                }
            }
            break;
        case 'joined':
            payload = getStringFromCodes(payload);
            index = roomObj.members.indexOf(payload);
            if (index === -1) {
                roomObj.members.push(payload);
                roomObj.emit('joined', payload);
            }
            break;
        case 'leave':
            if (room === 'root') {
                roomObj.socket.close();
            } else {
                roomObj.open = false;
                roomObj.emit('close');
                delete this.rooms[room];
            }
            roomObj.send('left', roomObj.id);
            break;
        case 'left':
            payload = getStringFromCodes(payload);
            index = roomObj.members.indexOf(payload);
            if (index !== -1) {
                roomObj.members.splice(index, 1);
                roomObj.emit('left', payload);
            }
            break;
        default:
            roomObj.emit(event, payload, src);
            break;
        }
    };


    WSRooms.prototype.join = function (room) {
        var sock = {};

        if (!this.open) {
            throw new Error('Cannot join a room if the root socket is not open.');
        }
        if (!room || typeof room !== 'string' || room === 'root') {
            throw new Error('Cannot join room ' + room);
        }
        if (this.rooms.hasOwnProperty(room)) {
            return this.rooms[room];
        }
        emitter(sock);
        sock.open = false;
        sock.id = '';
        sock.room = room;
        sock.members = [];
        sock.socket = this.socket;
        sock.send = this.send.bind(sock);
        sock.leave = this.leave.bind(sock);
        this.rooms[room] = sock;
        sock.send('join', '');
        return sock;
    };


    WSRooms.prototype.leave = function () {
        this.send('leave', '');
    };


    WSRooms.prototype.purge = function () {
        Object.keys(this.rooms).forEach(function (room) {
            if (room !== 'root') {
                this.rooms[room].leave();
            }
        }, this);
    };


    WSRooms.prototype.onclose = function () {
        Object.keys(this.rooms).forEach(function (room) {
            this.rooms[room].open = false;
            this.rooms[room].emit('close');
            delete this.rooms[room];
        }, this);
        this.open = false;
        this.emit('close');
    };


    WSRooms.prototype.onerror = function (e) {
        this.emit('error', e);
    };


    global.wsrooms = function wsrooms(url) {
        return new WSRooms(url);
    };


    wsrooms.isTypedArray = isTypedArray;
    wsrooms.getStringFromCodes = getStringFromCodes;
    wsrooms.getCodesFromString = getCodesFromString;


}(window || this));
