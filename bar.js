var port, fullname, info, loggedIn

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
  port.postMessage({action:'vote', likes:info.likes})
}

function toggleSaved() {
  info.saved = !info.saved
  update()
  if (info.saved) {
    port.postMessage({action:'save'})
  } else {
    port.postMessage({action:'unsave'})
  }
}

function update() {
  $('#title').text(info.title)
  fitHeight()

  if (loggedIn) {
    $('#bar').removeClass('logged-out').addClass('logged-in')
  } else {
    $('#bar').removeClass('logged-in').addClass('logged-out')
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
  $('#score').text(info.score)
  if (info.subreddit) {
    var subPath = '/r/'+info.subreddit
    $('#subreddit')
      .text(subPath)
      .attr('href', 'http://www.reddit.com/'+subPath)
  } else {
    $('#bar').removeClass('subreddit')
  }
  $('#comments span').text(info.num_comments)
}

$(document).ready(function() {
  $(window).resize(fitHeight)

  $('#comments').click(function(e) {
    clickOpenURL(e, 'http://reddit.com'+info.permalink)
  })
  
  $('#like').click(function() {
    vote(info.likes == true ? null : true)
  })

  $('#dislike').click(function() {
    vote(info.likes == false ? null : false)
  })

  $('#save').click(function() {
    toggleSaved()
  })

  $('#login').click(function () {
    window.open('http://reddit.com/login/')
  })

  $('#close').click(function() {
    msgJSON({action:'close'})
  })
})

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
