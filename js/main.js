'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var turnReady;
var pcConfig = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]};
var sdpConstraints = { offerToReceiveAudio: true, offerToReceiveVideo: true };
var room = 'foo';
var socket = io.connect();
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');


socket.on('created-room', function (room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('joined-room', function (room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('room-full', function (room) {
  console.log('Room ' + room + ' is full');
});

socket.on('someone-joined', function (room) {
  console.log('Another peer made a request to join room ' + room);
  isChannelReady = true;
});


socket.on('log', function (array) {
  console.log.apply(console, array);
});

socket.on('message', function (message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    followerDoAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});


function sendMessage(message) {
  // console.log('Client sending message: ', message);
  socket.emit('message', message);
}

navigator.mediaDevices
  .getUserMedia({audio: false, video: true})
  .then(gotStream);

socket.emit('create or join', room);

function gotStream(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media'); 
  if (isInitiator) {
    maybeStart();
  }
}

function maybeStart() {
  console.log('>>>>>>> maybeStart() '); //, isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> maybeStart() TRUE - creating peer connection');
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.addEventListener('track', function(e) {
      remoteVideo.srcObject = e.streams[0];
    });
    pc.addStream(localStream);
    isStarted = true;
    if (isInitiator) {
      console.log('Sending offer to peer');
      pc.createOffer(
        function(sessionDescription) {
            pc.setLocalDescription(sessionDescription);
            console.log('sending Session Description', sessionDescription);
            sendMessage(sessionDescription);
        },
        function(event) { console.log('ERROR - createOffer() error: ', event); });
    }
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates');
  }
}

function followerDoAnswer() {
  console.log('Sending answer to Initiator');
  pc.createAnswer().then(
    function(sessionDescription) {
      pc.setLocalDescription(sessionDescription);
      console.log('sending Session Description', sessionDescription);
      sendMessage(sessionDescription); 
    },
    function(error) { trace('ERROR - Failed to create session description: ' + error.toString()); }
  );
}




// if (location.hostname !== 'localhost') {
//   requestTurn(
//     'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
//   );
// }

// function requestTurn(turnURL) {
//   var turnExists = false;
//   for (var i in pcConfig.iceServers) {
//     if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
//       turnExists = true;
//       turnReady = true;
//       break;
//     }
//   }
//   if (!turnExists) {
//     console.log('Getting TURN server from ', turnURL);
//     // No TURN server. Get one from computeengineondemand.appspot.com:
//     var xhr = new XMLHttpRequest();
//     xhr.onreadystatechange = function () {
//       if (xhr.readyState === 4 && xhr.status === 200) {
//         var turnServer = JSON.parse(xhr.responseText);
//         console.log('Got TURN server: ', turnServer);
//         pcConfig.iceServers.push({
//           'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
//           'credential': turnServer.password
//         });
//         turnReady = true;
//       }
//     };
//     xhr.open('GET', turnURL, true);
//     xhr.send();
//   }
// }




function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = true;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

window.onbeforeunload = function () {
  sendMessage('bye');
};