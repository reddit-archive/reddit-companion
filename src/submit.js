function updateTarget() {
  var target =
    'http://www.reddit.com/submit/?resubmit=true'+
    '&url='+window.location.hash.substr(1)+
    '&title='+encodeURIComponent($('#title-input').val())
  $('#submit').attr('href', target)
  return target
}

function randomMsg() {
  $('#title-input').attr('placeholder', function(i, val) {
    var adjs = ['a clever', 'a snarky', 'a nifty', 'an exciting', 'an alluring', 'a juicy', 'an engaging', 'a concise'],
        ends = ['Be witty!', 'Be silly!', 'Be nice!', 'Huzzah!', 'Have fun!', 'Good luck!']
    return 'Enter '+randomChoice(adjs)+' title to share this page with reddit. '+randomChoice(ends)
  })
}

$(document).ready(function() {
  $(window).resize(fitHeight)

  $('#title-input').keyup(function(e) {
    updateTarget()
    if (e.which == 13) {
      window.top.location = $('#submit').attr('href')
    }
  })
  
  $('#close').click(function() {
    msgJSON({action:'close'})
  })

  randomMsg()
  fitHeight()
})
