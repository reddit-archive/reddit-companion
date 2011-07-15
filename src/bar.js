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
  if(localStorage['showTooltips'] == "true") {
    info.saved ? $('#save').attr('title','Unsave') : $('#save').attr('title','Save')
  }
  update()
  if (info.saved) {
    port.postMessage({action:'save'})
  } else {
    port.postMessage({action:'unsave'})
  }
}

function update() {
  $('#title')
    .text(info.title)
    .attr('href', 'http://reddit.com'+info.permalink)
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
      .attr('href', 'http://www.reddit.com'+subPath)
  } else {
    $('#bar').removeClass('subreddit')
  }
  $('#comments span').text(info.num_comments)
  
  if(localStorage['showTooltips'] == "true") {
    $('#logo').attr('title','Reddit Home')
	$('#comments').attr('title','View Comments')
	$('#upvote').attr('title','Upvote')
	$('#downvote').attr('title','Downvote')
	$('#save').attr('title','Save')
	$('#login').attr('title','Login')
	$('#close').attr('title','Close')
    $('#score').attr('title',info.score == null ? "Error" : info.score+' upvotes') //the null seems to be caused by slow data. Usually fixed when update() is called for the second time.
    $('#title').attr('title',info.title)
    $('#subreddit').attr('title','/r/'+info.subreddit)
  }
}

$(document).ready(function() {
  $(window).resize(fitHeight)
  
  $('#comments').click(function(e) {
    clickOpenURL(e, 'http://reddit.com'+info.permalink)
  })
  
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
