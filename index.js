var crypto = require("crypto");
const dgram = require('dgram');
const socket = dgram.createSocket('udp4');



module.exports = {
    get_random: function(length) {
        return crypto.randomBytes(length);
    },
    send_packet: function(data, server) {
        socket.send(data, server.port, server.ip);
    },
    send_getinfo: function(server) {
        server.token = get_random(1);
        server.extratoken = get_random(2);
        server.response = false;

        // vanilla, ext
        data = "xe" + server.extratoken + "xD" + "\xff\xff\xff\xffgie3" + server.token;
        send_packet(data, server);

        // legacy64
        data = "tezcan" + "\xff\xff\xff\xfffstd" + server.token;
        send_packet(data, server);
    },
    unpack_int: function(slots) {
        var src = slots[0];

        if(src === '') {
            slots.shift();
            return 0;
        }

        var offset = 0;

        var byte = src[offset].charCodeAt(0);
        var sign = (byte >> 6) & 0x01;
        var value = byte & 0x3f;
        while (true) {
            if (!(byte & 0x80)) {
                break;
            }
            offset += 1;
            byte = src[offset].charCodeAt(0);
            value |= (byte & 0x7f) << (offset*7 - 1);
            if (offset === 4) {
                break;
            }
        }
        slots[0] = src.substring(0, offset + 1);
        if (sign) {
            value = -value;
        }
        return value;
    },
    inArray: function(needle, haystack) {
        var length = haystack.length;
        for(var i = 0; i < length; i++) {
            if(haystack[i] == needle) return true;
        }
        return false;
    },
    parse_info: function(type, slots, initclients, server) {
        if(type !== 'extmore') {
            server.version = String(slots.shift());
            server.name = String(slots.shift());
            server.map = String(slots.shift());

            if(type === 'ext') {
                server.mapcrc = parseInt(slots.shift());
                server.mapsize = parseInt(slots.shift());
            }

            server.gametype = String(slots.shift());
            server.flags = parseInt(slots.shift());
            server.numplayers = parseInt(slots.shift());
            server.maxplayers = parseInt(slots.shift());
            server.numclients = parseInt(slots.shift());
            server.maxclients = parseInt(slots.shift());
        }

        if(initclients) {
            server.clients = [];
            server.clientcount = 0;
        }

        var clientnum = 0;
        if(type === '64legacy') {
            clientnum = unpack_int(slots);
        }

        var packetnum = 0;
        if(type === 'extmore') {
            packetnum = parseInt(slots.shift());
        }

        if(server.type === 'ext') {
            slots.shift();

            if(server.clientpackets == undefined) {
                server.clientpackets = [];
            }

            if(!inArray(packetnum, server.clientpackets)) {
                server.clientpackets.push(packetnum);
            }
            else {
                return;
            }
        }

        while(true) {
            if(slots.length == 0) {
                return;
            }

            if(type === 'vanilla' && server.clientcount == 16) {
                return;
            }

            if(server.clientcount == 64) {
                return;
            }

            var addclient = true;
            if(type == '64legacy') {
                if(server.clientnumbers == undefined) {
                    server.clientnumbers = [];
                }
                if(!inArray(clientnum, server.clientnumbers)) {
                    server.clientnumbers.push(clientnum);
                }
                else {
                    addclient = true;
                }
            }

            var client = object();
            client.name = String(slots.shift());
            client.clan = String(slots.shift());
            client.country = parseInt(slots.shift());
            client.score = parseInt(slots.shift());
            client.player = parseInt(slots.shift());

            if(server.type == 'ext') {
                slots.shift();
            }

            if(addclient) {
                server.clients.push(client);
                server.clientcount += 1;
            }

            clientnum += 1;
        }
    },
    process_packet: function(data, server) {
        if(data.substring(6, 8) == '\xff\xff\xff\xffinf3') {
            type = 'vanilla';
        }
        else if (data.substring(6, 8) === "\xff\xff\xff\xffdtsf") {
            type = '64legacy';
        }
        else if (data.substring(6, 8) === "\xff\xff\xff\xffiext") {
            type = 'ext';
        }
        else if (data.substring(6, 8) === "\xff\xff\xff\xffiex+") {
            type = 'extmore';
        }
        else {
            return;
        }

        var stype;
        if (type === 'extmore') {
            stype = 'ext';
        }
        else {
            stype = type;
        }

        slots = data.substring(14, data.length - 15).split("\x00");
        token = parseInt(slots.shift())

        if((token & 0xff) != server.token.charCodeAt(0)) {
            return;
        }

        if(stype == 'ext') {
            extratoken = ((server.extratoken[0].charCodeAt(0) << 8) + server.extratoken[1].charCodeAt(0));

            if((token & 0xffff00) >> 8 != extratoken) {
                return;
            }
        }

        server.response = true;

        initclients = false;

        if (server.type == undefined) {
            server.type = stype;
            initclients = true;
        }
        else if (server.type == 'vanilla') {
            if (stype == '64legacy' || stype == 'ext') {
                server.type = stype;
                initclients = true;
            }
        }
        else if (server.type == '64legacy') {
            if (stype == 'vanilla') {
                return;
            }
            else if (stype == 'ext') {
                server.type = stype;
                initclients = true;
            }
        }
        else if (server['type'] === 'ext') {
            if (stype === 'vanilla' || stype === '64legacy') {
                return;
            }
        }

        parse_info(type, slots, initclients, server);
    },
    recieve_packet: function(servers) {
    },
    fill_server_info: function(servers) {

    }
};