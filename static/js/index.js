//define variables
var roomId = null;
var ws = new WebSocket('wss://' + location.host + '/webrtc');
var myUserId = null;
var roommates = {};
var localVideo;
var rooms = [];
var joinerRoomId;
var videoWrapper;
ws.onopen = function(){
	console.log('socet was opened');
}
window.onbeforeunload = function() {
  ws.close();
}
function inArray(needle,haystack)
{
    var count=haystack.length;
    for(var i=0;i<count;i++)
    {
        if(haystack[i]===needle){return true;}
    }
    return false;
}
//sending and answering messages with the server.js
ws.onmessage = function(message) {
	var parsedMessage = JSON.parse(message.data);
	console.info('Received message: ' + message.data);
     
	switch (parsedMessage.id) {
	case 'connected':
	 var receivedRooms = parsedMessage.rooms;
	   for(var i=0; i<receivedRooms.length; i++){
		 while(!inArray(receivedRooms[i], rooms)){
			 
			 rooms.push(receivedRooms[i]);
		 } 
	   }
	    for(var i=0; i<rooms.length; i++){
		 while(!inArray(rooms[i], receivedRooms)){
			 var pos = rooms.indexOf(rooms[i]);
			 rooms.splice(pos, 1);
		 } 
	   }
	  var path = window.location.pathname.substring(1);
	  if(path){
		  if(path.length > 0){
			  if(inArray(path, rooms)){
      if(sessionStorage.getItem('name') != null){//checking if you a room holder
      registerRoomHolder();
      }else{
      registerRoomJoiner();
      }
     
			  }
		  }
		  
	  }
	   break;

	//first answer that we receive from server after 
    //creating the room
    //now the server has the path with the room name
    //and we ready to load it
	case 'registeringRoom':
	   window.location.replace("/"+roomId);
	   sendMessage(
	   {id: 'roomHolderInRoom'}
	   );
	   break;
    case 'roomRegistered':
	    roomHolderResponse(parsedMessage);
	    break;
	case 'joinerRegistered':
	    roomJoinerResponse(parsedMessage);
	   break;
	case 'roomJoinerInRoom':
	
	    break;
	case 'error':
	
	    break;
	
   
	case 'test':
	  
		 console.log(parsedMessage.users);
	   break;
	 case "iceCandidate":
            console.log("iceCandidate from : " + parsedMessage.sessionId);
            var roommate = roommates[parsedMessage.sessionId];
            if (roommate != null) {
                console.log(parsedMessage.candidate);
                roommate.rtcPeer.addIceCandidate(parsedMessage.candidate, function (error) {
                    if (error) {
                        if (parsedMessage.sessionId === sessionId) {
                            console.error("Error adding candidate to self : " + error);
                        } else {
                            console.error("Error adding candidate : " + error);
                        }
                    }
                });
            } else {
                console.error('still does not establish rtc peer for : ' + parsedMessage.sessionId);
            }
	   break;
	 case 'newRoommate':
	 
	 updateReceivedVideo(parsedMessage);
	  break;
	  
	 case 'existingRoommate':
	 onExistingRoommates(parsedMessage);
	  break;
	 case 'receiveVideoAnswer':
	 onReceiveVideoAnswer(parsedMessage);
	  break;
	case "roommateLeft":
	
	onParticipantLeft(parsedMessage);
	  break;
	default:
		console.error('Unrecognized message', parsedMessage);
	}
}



//universal function for sending messages to the server.js
function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	console.log('Senging message: ' + jsonMessage);
	ws.send(jsonMessage)
}
//after typing a name of the room and typing Create room button
//we need to send the message with the room name to the server
//so it could create pathe with that room name and we could
//load this page

function createRoom(){
	if (document.getElementById('roomName').value.replace(/\s/g, '') == '') {
		window.alert("You must specify the name of room");
		return;
	}
	roomId = document.getElementById('roomName').value.replace(/\s/g, '');
	//a room name must be saved with the sessionStorage so
	//we know that we are creator of the room
	
	if(inArray(roomId, rooms)){
	 
       return;
	  }else {
	   sessionStorage.setItem("name", roomId);
	   var message = {
		id : 'registerRoom',
		name : roomId
	};
	
	   sendMessage(message);
	  }
	
	
}
 



function joinRoom(){
	if (document.getElementById('JoinRoomName').value.replace(/\s/g, '') == '') {
		window.alert("You must specify the name of room you want to join");
		return;
	}
	var roomPath;
	roomPath = document.getElementById('JoinRoomName').value.replace(/\s/g, '');
	if(!inArray(roomPath, rooms)){
	
  	 return;   
	 } else{
	 
	 window.location.replace("/"+roomPath);
	  }
	
  
}
//array of functions that has to be launched once the room creator enters a room
//1. registering his data as room holder and sending back the data
function registerRoomHolder(){
	roomIdInRoom = sessionStorage.getItem('name');
	var message = {
				id: 'roomHolderInRoom',
                room: roomIdInRoom
			};
			sendMessage(message);
	sessionStorage.removeItem("name"); 
}
//2. receiving answer from server about name ID
function roomHolderResponse(message) {
  myUserId = message.userId;
  var newMessage = {
				id: 'join',
                room: roomIdInRoom,
				name: myUserId
			};
			sendMessage(newMessage);
	console.log(myUserId+'//////////////////////////////////');
	console.log(roomIdInRoom);
}
function registerRoomJoiner(){
	roomIdInRoom = null;
	joinerRoomId = window.location.pathname.substring(1);
	var message = {
				id: 'roomJoinerInRoom',
                room: joinerRoomId
			};
	   console.log(joinerRoomId);
	   sendMessage(message);
}
function roomJoinerResponse(message) {
  myUserId = message.userId;
  var newMessage = {
				id: 'join',
                room: joinerRoomId,
				name: myUserId
			};
			sendMessage(newMessage);
	console.log(myUserId);
}
//////////////////////////////////////////////////////////////////////
function onIceCandidate(candidate) {
	console.log('Local candidate' + JSON.stringify(candidate));

	var message = {
		id : 'onRoomIceCandidate',
		candidate : candidate,
		name: myUserId
	}
	sendMessage(message);
}
//////////////////////////////////////////////////////////////////////
//reacting on an apearing of new roommate video
function receivedVideo(sender) {
    console.log(myUserId + " receive video from " + sender);
    var roommate = new Roommates(sender, myUserId);
    roommates[sender] = roommate;

    var video = createRemoteVideo(roommate);

    // bind function so that calling 'this' in that function will receive the current instance
    var options = {
        remoteVideo: video,
        onicecandidate: roommate.onIceCandidate.bind(roommate)
    };

    roommate.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function (error) {
        if (error) {//for each roommate a new WebRTC instance generated
            return console.error(error);
        }
        this.generateOffer(roommate.offerToReceiveVideo.bind(roommate));
    });
	 arrangeVideo();
}
//creating video element for a new roommate
function createRemoteVideo(roommate) {
    var videoId = "video-" + roommate.id;
	var divId = "div-" + roommate.id;
    var pauseEl = "pause"+roommate.id;
	var volumeEl = "volume"+roommate.id;
	$('<div id="'+divId+'" class="wrappers"><video id="'+videoId+'"style = "width: 300px; float: left; margin-left: 5px;" autoplay></video>\
	<p>\
    <span id="pause'+roommate.id+'" class="remotePause" onclick="pausePlay(\''+videoId+'\', \''+pauseEl+'\')"><i class="material-icons">pause</i></span>\
    <span id="volume'+roommate.id+'" class="remoteVolume" onclick="volumeMute(\''+videoId+'\', \''+volumeEl+'\')"><i class="material-icons">volume_up</i></span>\
    </p>\
	<div>'
	).appendTo(document.getElementById("remoteVideo"));
    return document.getElementById(videoId);
}
//inserting a new roommate videoelement if such is received
function updateReceivedVideo(message) {
    receivedVideo(message.new_user_id)
	 arrangeVideo();
}
//reacting on first joining to room (no matter existing or just created)
function onExistingRoommates(message) {
    var constraints = {
        audio: true,
        video: {
            mandatory: {
                maxFrameRate: 15,
                minFrameRate: 15
            }
        }
    };
    console.log(myUserId + " register in room " + message.roomName);
     swPlay = false;
	 swSound = false;
    // create video for current user to send to server
    var localParticipant = new Roommates(myUserId, myUserId);
    roommates[myUserId] = localParticipant;
    localVideo = document.getElementById('videoInput');
    var video = localVideo;

    // bind function so that calling 'this' in that function will receive the current instance
    var options = {
        localVideo: video,
        mediaConstraints: constraints,
        onicecandidate: localParticipant.onIceCandidate.bind(localParticipant)
    };


    localParticipant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function (error) {
        if (error) {
            return console.error(error);
        }

        // Set localVideo to new object if on IE/Safari
        localVideo = document.getElementById("videoInput");

        // initial main video to local first
        localVideoCurrentId = myUserId;
        localVideo.src = localParticipant.rtcPeer.localVideo.src;
        localVideo.muted = true;
        //videoWrapper = document.createElement('div');  
		//videoWrapper.setAttribute('id', 'localVideoDiv');
       // videoWrapper.appendChild(localVideo);

        console.log("local participant id : " + myUserId);
        this.generateOffer(localParticipant.offerToReceiveVideo.bind(localParticipant));
    });

    // get access to video from all the participants
    console.log(message.data);
    for (var i in message.data) {
        receivedVideo(message.data[i]);
    }
}

function onReceiveVideoAnswer(message) {
    var participant = roommates[message.sessionId];
    participant.rtcPeer.processAnswer(message.sdpAnswer, function (error) {
        if (error) {
            console.error(error);
        } else {
            participant.isAnswer = true;
            while (participant.iceCandidateQueue.length) {
                console.error("collected : " + participant.id + " ice candidate");
                var candidate = participant.iceCandidateQueue.shift();
                participant.rtcPeer.addIceCandidate(candidate);
            }
        }
    });
}
//function for leaving room
function leaveRoom(){

    roommates[myUserId].rtcPeer.dispose();
    
    roommates = {};
    var message = {
        id: "leaveRoom",
		name: myUserId
    };
	sendMessage(message);
    
	 var videoElement = document.getElementById("videoInput");
     videoElement.pause();
     videoElement.src =""; 
   

    var myNode = document.getElementById("remoteVideo");
    while (myNode.firstChild) {
        myNode.removeChild(myNode.firstChild);
    }
	 window.location.replace("/");
}


function onParticipantLeft(message) {
    var participant = roommates[message.sessionId];
    participant.dispose();
    delete roommates[message.sessionId];

  
   var video = document.getElementById("video-" + participant.id);
   var myNode = document.getElementById("remoteVideo");
     myNode.removeChild(video);
  
}

//functions for managing video controls
function pausePlay(el, i){
	var el = document.getElementById(el);
	var i = document.getElementById(i);
	if(i.innerHTML == '<i class="material-icons">pause</i>'){
	i.innerHTML = '<i class="material-icons">play_arrow</i>';
	el.pause();
	}else{
	i.innerHTML = '<i class="material-icons">pause</i>';	
	el.play();	
	}
}
function volumeMute(el, i){
	var el = document.getElementById(el);
	var i = document.getElementById(i);
	if(i.innerHTML == '<i class="material-icons">volume_up</i>'){
	i.innerHTML = '<i class="material-icons">volume_off</i>';
	el.muted = true;
	}else{
	i.innerHTML = '<i class="material-icons">volume_up</i>';
	el.muted = false;	
	}
	
}
//function for arranging remote video elements
function arrangeVideo(){
	if(document.querySelectorAll('#remoteVideo div').length != 0){
	var childNumber = document.querySelectorAll('#remoteVideo div').length/2;
	if(document.querySelectorAll('#remoteVideo div').length/2 == 1){
      $("#remoteVideo .wrappers").css({'margin': '0 auto'});
	}
	
    switch (childNumber){
	case 1:
    
    break;		
	}	
	}
}
function testResult(){
	
	alert('The number of children of remoteVideo are '+(document.querySelectorAll('#remoteVideo div').length/2));
}























