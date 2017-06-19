
var Registry = require('./registry.js');
var User = require('./user.js');
var registry = new Registry();
var path = require('path');
var express = require('express');
var ws = require('ws');
var minimist = require('minimist');
var url = require('url');
var kurento = require('kurento-client');
var fs    = require('fs');
var https = require('https');
var nextID = null; //(my corrections) creating unique user Id for creating room ever if a user has not been registered
var anonymousUser = {};
var isInitiator = false;
var rooms = [];
var videoRooms = {};
var holder = null;
var ip = require("ip");
var argv = minimist(process.argv.slice(2), {
  default: {
      as_uri: "https://localhost:8443/",
      ws_uri: "ws://localhost:8888/kurento"
  }
});

var options =
{
  key:  fs.readFileSync('keys/server.key'),
  cert: fs.readFileSync('keys/server.crt')
};
function inArray(needle,haystack)
{
    var count=haystack.length;
    for(var i=0;i<count;i++)
    {
        if(haystack[i]===needle){return true;}
    }
    return false;
}
var app = express();

/*
 * Definition of global variables.
 */

var kurentoClient = null;
var pipelines = {};
var candidatesQueue = {};



/*
 * Server startup
 */

var asUrl = url.parse(argv.as_uri);
var port = asUrl.port;
var server = https.createServer(options, app).listen(port, function() {
    console.log('WebRTC started. Listening for port 8443. ');
    console.log('Open ' + 'https://'+ip.address()+':8443' + ' with a WebRTC capable browser');
});

var wss = new ws.Server({
    server : server,
    path : '/webrtc'
});

wss.on('connection', function(ws) {
	
 
   if(rooms.length != 0){
   ws.send(JSON.stringify({id: 'connected', rooms: rooms}));   
   }
   
   
    ws.on('error', function(error) {
     
    });

    ws.on('close', function() {
		
   
    });

    ws.on('message', function(_message) {
        var message = JSON.parse(_message);
 

        switch (message.id) {
	
        case 'registerRoom':
		
		    registerRoom(message, ws); //this must be a function to register new room like register new user (my correction)
			break;
		case 'roomHolderInRoom':
		
		nextID = Date.now(); 
		registry.register(new User(nextID, ws, true));
		ws.send(JSON.stringify({id: 'roomRegistered', userId: nextID}));
		    break;
		case 'join':
		    console.log('receive meassage join from ' +message.name);
			joinChat(message.name, message.room);
		    break;
		case 'roomJoinerInRoom':
		
		nextID = Date.now(); 
		registry.register(new User(nextID, ws, true));
		ws.send(JSON.stringify({id: 'joinerRegistered', userId: nextID}));
		    break;
		
	
        case 'onIceCandidate':
                addIceCandidate(message.master, message);
                break;
		case 'receiveVideoFrom':
                console.log(message.master + ' receiveVideoFrom : ' + message.sender);
                receiveVideoFrom(message.master, message.sender, message.sdpOffer, function () {

                });
                break;	
		case 'aboutToLeave':
		    leaveRoom(message.name);
			register.unregister(message.name);
		       break;
        case 'leaveRoom':
            
            leaveRoom(message.name);
                break;		
        default:
            ws.send(JSON.stringify({
                id : 'error',
                message : 'Invalid message ' + message
            }));
            break;
        }

    });
});
////////////////////////////////////////////////////////
/////////////////////New!!!!!!!!!!!//////////////////////
////////////////////////////////////////////////////////
///////////////////////////////////////////////////////
function joinChat(id, roomName, callback) {
	console.log('joinChat function was launched');
    getRoom(roomName, function (error, room) {
        if (error) {
            callback(error)
        }
        join(id, room, function (error, user) {
            console.log('join success : ' + user.id);
        });
    });
}


function getRoom(roomName, callback) {

    var room = videoRooms[roomName];

    if (room == null) {
        console.log('create new room : ' + roomName);
        getKurentoClient(function (error, kurentoClient) {
            if (error) {
                return callback(error);
            }

            // create pipeline for room
            kurentoClient.create('MediaPipeline', function (error, pipeline) {
                if (error) {
                    return callback(error);
                }

                room = {
                    name: roomName,
                    pipeline: pipeline, //created pipline was saved in room object as a property
                    roommates: {}    //from this point room with this name has pipline
                };
                videoRooms[roomName] = room;
                callback(null, room);
            });
        });
    } else {
        console.log('get existing room : ' + roomName);
        callback(null, room); //or if room already exists the function just return this room
    }
}

 //in any case after the getRoom function we ready to go
 //because we have existing room with a pipline in it
 //so the next stage is join function which creates WebRtcEndpoint
function join(id, room, callback) {
    // create user session
    var userSession = registry.getById(id);
    userSession.setRoomName(room.name);

    room.pipeline.create('WebRtcEndpoint', function (error, outgoingMedia) {
        if (error) {
            console.error('no participant in room');
            // no roommates in room yet release pipeline
            if (Object.keys(room.roommates).length == 0) {
                room.pipeline.release();
            }
            return callback(error);
        }
        outgoingMedia.setMaxVideoSendBandwidth(30);
        outgoingMedia.setMinVideoSendBandwidth(20);
        userSession.outgoingMedia = outgoingMedia;

         //add ice candidate the get sent before endpoint is established
        var iceCandidateQueue = userSession.iceCandidateQueue[id];
        if (iceCandidateQueue) {
            while (iceCandidateQueue.length) {
                var message = iceCandidateQueue.shift();
               // console.error('user : ' + userSession.id + ' collect candidate for outgoing media');
                userSession.outgoingMedia.addIceCandidate(message.candidate);
            }
        }

        userSession.outgoingMedia.on('OnIceCandidate', function (event) {
            console.log("generate outgoing candidate : " + userSession.id);
            var candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
            userSession.sendMessage({
                id: 'iceCandidate',//launches addIceCandidate on client side
                sessionId: userSession.id,
                candidate: candidate
            });
        });

        // notify other user that new user is joining
        var usersInRoom = room.roommates;
        var data = {
            id: 'newRoommate',//launches function receiveVideoFrom on each usersInRoom
            new_user_id: userSession.id
        };

        // notify existing user
        for (var i in usersInRoom) {
            usersInRoom[i].sendMessage(data);
        }

        var existingUserIds = [];
        for (var i in room.roommates) {
            existingUserIds.push(usersInRoom[i].id);
        }
        // send list of current user in the room to current participant
        userSession.sendMessage({
            id: 'existingRoommate',//launches onExistingParticipants which create a new Participants localy
            data: existingUserIds,     //this function create a "video" to send to other participants, create a local video,
            roomName: room.name         //and launches receiveVideoFrom for each existingUserIds
        });

        // register user to room
        room.roommates[userSession.id] = userSession;

        callback(null, userSession);
    });
}



///functions to responds for roommates sent messages
function addIceCandidate(id, message) {
    var user = registry.getById(id);
    if (user != null) {
        // assign type to IceCandidate
        var candidate = kurento.register.complexTypes.IceCandidate(message.candidate);
        user.addIceCandidate(message, candidate);
    } else {
        console.error('ice candidate with no user receive : ' + id);
    }
}
function getEndpointForUser(userSession, sender, callback) {
    // request for self media

    if (userSession.id === sender.id) {
        callback(null, userSession.outgoingMedia);
        return;
    }

    var incoming = userSession.incomingMedia[sender.id];
    if (incoming == null) {
        console.log('user : ' + userSession.id + ' create endpoint to receive video from : ' + sender.id);
        getRoom(userSession.roomName, function (error, room) {
            if (error) {
                return callback(error);
            }

            room.pipeline.create('WebRtcEndpoint', function (error, incomingMedia) {
                if (error) {
                    // no participants in room yet release pipeline
                    if (Object.keys(room.participants).length == 0) {
                        room.pipeline.release();
                    }
                    return callback(error);
                }
                console.log('user : ' + userSession.id + ' successfully created pipeline');
                incomingMedia.setMaxVideoSendBandwidth(30);
                incomingMedia.setMinVideoSendBandwidth(20);
                userSession.incomingMedia[sender.id] = incomingMedia;

                // add ice candidate the get sent before endpoint is established
                var iceCandidateQueue = userSession.iceCandidateQueue[sender.id];
                if (iceCandidateQueue) {
                    while (iceCandidateQueue.length) {
                        var message = iceCandidateQueue.shift();
                        console.log('user : ' + userSession.id + ' collect candidate for : ' + message.data.sender);
                        incomingMedia.addIceCandidate(message.candidate);
                    }
                }

                incomingMedia.on('OnIceCandidate', function (event) {
                    console.log("generate incoming media candidate : " + userSession.id + " from " + sender.id);
                    var candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
                    userSession.sendMessage({
                        id: 'iceCandidate',
                        sessionId: sender.id,
                        candidate: candidate
                    });
                });
                sender.outgoingMedia.connect(incomingMedia, function (error) {
                    if (error) {
                        callback(error);
                    }
                    callback(null, incomingMedia);
                });

            });
        });
    } else {
        console.log('user : ' + userSession.id + ' get existing endpoint to receive video from : ' + sender.id);
        sender.outgoingMedia.connect(incoming, function (error) {
            if (error) {
                callback(error);
            }
            callback(null, incoming);
        });
    }
}


function receiveVideoFrom(id, senderId, sdpOffer, callback) {
    var userSession = registry.getById(id);
    var sender = registry.getById(senderId);

    getEndpointForUser(userSession, sender, function (error, endpoint) {
        if (error) {
            callback(error);
        }

        endpoint.processOffer(sdpOffer, function (error, sdpAnswer) {
            console.log("process offer from : " + senderId + " to " + userSession.id);
            if (error) {
                return callback(error);
            }
            var data = {
                id: 'receiveVideoAnswer',
                sessionId: sender.id,
                sdpAnswer: sdpAnswer
            };
            userSession.sendMessage(data);

            endpoint.gatherCandidates(function (error) {
                if (error) {
                    return callback(error);
                }
            });
            return callback(null, sdpAnswer);
        });
    });
}


/////////////////////////////////////////////////////
///////////////////////////////////////////////////////
////////////////////////////////////////////////////////
///////////////////////////////////////////////////////
// Recover kurentoClient for the first time
function getKurentoClient(callback) {
    if (kurentoClient !== null) {
        return callback(null, kurentoClient);
    }

    kurento(argv.ws_uri, function(error, _kurentoClient) {
        if (error) {
            var message = 'Coult not find media server at address ' + argv.ws_uri;
            return callback(message + ". Exiting with error " + error);
        }

        kurentoClient = _kurentoClient;
        callback(null, kurentoClient);
    });
}

//this function just creates a path so the page with a room name at 
//the end can load
function registerRoom(message, ws){
	//registering a new room (my correction)
	
		 while(!inArray(message.name, rooms)){
			 
			 rooms.push(message.name);
		 } 
	   
	
	    var addr = '/'+message.name;
		console.log(addr);
		app.get(addr, function(req, res){
		res.sendFile(__dirname + '/static/room.html');
	})
		

		var registeringRoom = {
		id: "registeringRoom"
	}	
			
	ws.send(JSON.stringify(registeringRoom));
}

app.get('/js/roommates.js', function(req, res){
		res.sendFile(__dirname + '/static/js/roommates.js');
	})
	
app.use(express.static(path.join(__dirname, 'static')));
//leave the room
function leaveRoom(sessionId, callback) {
    var userSession = registry.getById(sessionId);

    if (!userSession) {
        return;
    }

    var room = videoRooms[userSession.roomName];

    if(!room){
        return;
    }

    
    var usersInRoom = room.roommates;
	if(usersInRoom.length == 1){
	
		delete room;
		while(rooms.indexOf(room.roomName) != -1){
			var pos = rooms.indexOf(room.roomName);
			rooms.splice(pos, 1);
		}
		return;
	}
    delete usersInRoom[userSession.id];
    userSession.outgoingMedia.release();
    // release incoming media for the leaving user
    for (var i in userSession.incomingMedia) {
        userSession.incomingMedia[i].release();
        delete userSession.incomingMedia[i];
    }

    var data = {
        id: 'roommateLeft',
        sessionId: userSession.id
    };
    for (var i in usersInRoom) {
        var user = usersInRoom[i];
        // release viewer from this
        user.incomingMedia[userSession.id].release();
        delete user.incomingMedia[userSession.id];

        // notify all user in the room
        user.sendMessage(data);
    }

    delete userSession.roomName;
}
function deleteRoom(){
	
	
}

