$(document).ready(function() {
  var data = JSON.parse(window.location.hash.substr(1));

  window.scroll(0, 0)

  console.log("Received message data:", data)

  function expand(text) {
    return unescape(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  }

  $('#mail-image').attr('src', expand(data.image))
  $('#from').html(data.info.author)
  if (data.info.subreddit) {
    $('#r').html("/r/"+data.info.subreddit).addClass('sr')
  } else {
    $('#r').html("private message")
  }
  $('#subject').html(data.info.subject)
  $('#body').html(expand(data.info.body_html))
})
