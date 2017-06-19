

function Roommates(id, master) {
	this.master = master;
    this.id = id;
    this.rtcPeer = null;
    this.iceCandidateQueue = [];
}


Roommates.prototype.offerToReceiveVideo = function (error, offerSdp) {
    if (error) {
        return console.error("sdp offer error");
    }
    var msg = {
        id: "receiveVideoFrom",
		master: this.master,
        sender: this.id,
        sdpOffer: offerSdp
    };
    console.log('Invoking SDP offer callback function ' + msg.sender);
    sendMessage(msg);
};


Roommates.prototype.onIceCandidate = function (candidate) {
    //console.log(this.id + " Local candidate" + JSON.stringify(candidate));

    var message = {
        id: 'onIceCandidate',
        candidate : {
            candidate : candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex
        },
		master: this.master,
        sender: this.id
    };
    sendMessage(message);
};


Roommates.prototype.dispose = function () {
    console.log('Disposing participant ' + this.id);
    this.rtcPeer.dispose();
    this.rtcPeer = null;
};

