var port, fullname, info, loggedIn, id, isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor), isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor)

function likeDelta(likes) {
  if (likes == true) {
    return 1
  } else if (likes == false) {
    return -1
  } else {
    return 0
  }
}

function vote(likes) {
  info.score += likeDelta(likes) - likeDelta(info.likes)
  info.likes = likes
  update()
  sendMessage({action:'vote', likes:info.likes})
}

function toggleSaved() {
  info.saved = !info.saved
  update()
  if (info.saved) {
    sendMessage({action:'save'})
  } else {
    sendMessage({action:'unsave'})
  }
}

function update() {
  initButtons()

  $('#title').text(info.title)
  
  if (loggedIn) {
    $('#bar').removeClass('logged-out').addClass('logged-in')
  } else {
    $('#bar').removeClass('logged-in').addClass('logged-out')
  }

  fitHeight()

  if (info.permalink) {
    $('#title').attr('href', 'http://www.reddit.com'+info.permalink)
  }

  if (info.likes == true) {
    $('#bar').removeClass('disliked').addClass('liked')
  } else if (info.likes == false) {
    $('#bar').removeClass('liked').addClass('disliked')
  } else {
    $('#bar').removeClass('liked disliked')
  }

  if (info.saved == true) {
    $('#bar').addClass('saved')
  } else {
    $('#bar').removeClass('saved')
  }
  if (localStorage['showTooltips'] != 'false') {
    $('#save').attr('title', info.saved ? 'Unsave' : 'Save')
  }

  $('#score').html((info.score)?info.score:'&#149;')
  if (info.subreddit) {
    var subPath = '/r/'+info.subreddit
    $('#subreddit')
      .text(subPath)
      .attr('href', 'http://www.reddit.com'+subPath)
  } else {
    $('#bar').removeClass('subreddit')
  }
  $('#comments span').text(info.num_comments)
}

function initButtons() {
  if (buttonsReady || info._fake) { return }
  $('#comments').attr('href', 'http://www.reddit.com'+info.permalink)
  
  $('#upvote').click(function() {
    vote(info.likes == true ? null : true)
  })

  $('#downvote').click(function() {
    vote(info.likes == false ? null : false)
  })

  $('#save').click(function() {
    toggleSaved()
  })

  $('#login').click(function () {
    window.open('http://www.reddit.com/login/')
  })

  $('#close').click(function() {
    sendMessage({action:'close'})
    msgJSON({action:'close'})
  })

  buttonsReady = true
}

function sendMessage(action){
  if(isChrome)
    port.postMessage(action)
  if(isSafari){
    action.id=id;
    safari.self.tab.dispatchMessage("bar",action);
  }
}



$(document).ready(function() {
  if (localStorage['showTooltips'] == 'false') {
    $('#bar *[title]').removeAttr('title')
  }
  $(window).resize(fitHeight)
})

buttonsReady = false
if(isChrome){
  fullname = window.location.hash.substr(1)
  port = chrome.extension.connect({name:'bar:'+fullname})
  port.onMessage.addListener(function(msg) {
    switch (msg.action) {
      case 'update':
        console.log('Received updated info', msg)
        info = msg.info
        loggedIn = msg.loggedIn
        update()
        break
    }
  })
  port.postMessage({action:'update', useStored:'true'})
}

if(isSafari){
  temploc = window.location.hash.substr(1).split("&");
  id=temploc[0];
  fullname=temploc[1];
  safari.self.addEventListener("message",function(messageEvent) {
  var result = messageEvent.message;

    switch (messageEvent.name) {
      case 'update':
          info = result.info
          console.log("Received Update",info);
          loggedIn = result.loggedIn
          update()
        break;
      
    }
  },false);
//send the update message with id to background
  safari.self.tab.dispatchMessage("bar",{action:'connect',fullname:fullname,id:id});
}

