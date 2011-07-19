function scrapeThingInfo(thing) {
  var info = {};

  fullnameMatch = thing.className.match(/id-(\w+)/);
  if (!fullnameMatch) {
    return false;
  }
  info.name = fullnameMatch[1];
  
  info.title = thing.querySelector('a.title').innerText;

  var entry = thing.querySelector('.entry'),
      scoreClass = ''
  if (entry.classList.contains('likes')) {
    info.likes = true
    scoreClass = '.likes'
  } else if (entry.classList.contains('dislikes')) {
    info.likes = false
    scoreClass = '.dislikes'
  } else {
    info.likes = null
    scoreClass = '.unvoted'
  }

  info.saved = thing.classList.contains('saved')

  info.score = parseInt(thing.querySelector('.score'+scoreClass).innerText)
  
  info.subreddit = (thing.querySelector('a.subreddit') || document.querySelector('.redditname > a')).innerText

  info.num_comments = parseInt(thing.querySelector('.comments').innerText) || 0

  info.permalink = thing.querySelector('.comments').href.match(/.*reddit.com(\/.+)/)[1]
  
  info.domain = thing.querySelector('.domain > a').innerText
  info.is_self = info.domain == ('self.' + info.subreddit)
  
  info._ts = pageTimestamp

  console.log('Scraped info from page:', info)
  return info
}

function thingClicked(e) {
  var a = e.target
  if (a.nodeName != 'A' || !a.classList.contains('title')) { return }
    
  // Find the parent element of the clicked link that represents the entire thing.
  var el = a
  do {
    el = el.parentElement
  } while (el && !el.classList.contains('thing'))
  if (!el.classList.contains('thing')) {
    console.log('Error: Unable to locate clicked thing element.');
    return
  }

  // Clobber the reddit toolbar href manger.
  if (a.onmousedown) { a.onmousedown = '' }

  // Scrape the metadata.
  var info = scrapeThingInfo(el);
  if (info) {
    chrome.extension.sendRequest({action:'thingClick', url:a.href, info:info})
  }
}

// Capture click events to catch link clicks before the reddit toolbar link mangler gets them.
document.addEventListener('mousedown', thingClicked, true)

// FIXME: Crazy hacks to figure out the time the page was requested.
// We need to know when the page was actually fetched from reddit's servers to
// invalidate old data. It would be nice to put a timestamp in the reddit DOM
// or figure out a simpler way to get a reliable request timestamp for the
// page.
pageTimestamp = (function() {
  var nav = performance.navigation,
      freshData = nav.type == nav.TYPE_NAVIGATE || nav.type == nav.TYPE_RELOAD
  if (freshData || !sessionStorage._ts) {
    return sessionStorage._ts = Date.now()
  } else {
    return parseInt(sessionStorage._ts, 10)
  }
})()

console.log('Shine reddit content handler running.')

