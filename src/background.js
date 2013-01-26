function initOptions() {
  defaultOptions = {
    'autoShow': true,
    'autoShowSelf': true,
    'checkMail': true,
    'checkModMail': true,
    'allowHttps': false,
    'notifyTimeout': false,
    'notifyTime': 30,
    'notifyMessageContents': true,
    'showPageAction': true
  }

  for (key in defaultOptions) {
    if (localStorage[key] == undefined) {
      localStorage[key] = defaultOptions[key]
    }
  }
}

redditInfo = {
  freshAgeThreshold: 5*60,

  url: {},
  redirects: {},
  fullname: {
    _shine_demo: {
      title: 'companion bar',
      score: '\u221e',
      num_comments: '7',
      likes: true,
      _fake: true
    }
  },
  fetching: {},

  getURL: function(url) {
    return this.url[url] || this.fullname[this.redirects[url]]
  },

  getFullname: function(fullname) {
    return this.fullname[fullname]
  },

  setURL: function(url, info) {
    info._ts = info._ts || Date.now()
    var stored = this.fullname[info.name]
    if (!stored || stored._ts < info._ts) {
      this.url[url] = info
      this.fullname[info.name] = info
      console.log('Stored reddit info for', url, info)
    } else {
      console.log('Received info older than stored info. Did not store.', stored, info)
    }
  },

  request: function(options) {
    if (!options.data) { options.data = {} }
    options.data['app'] = 'shine'
    $.ajax(options)
  },

  update: function(callback) {
    this.request({
      url: 'http://www.reddit.com/api/me.json',
      success: function(resp) {
        if (resp.data) {
          console.log('Updated reddit user data', resp.data)
          this.storeModhash(resp.data.modhash)
          this.storeUsername(resp.data.name)
          if (callback) { callback(resp.data) }
        }
      }.bind(this),
      error: function() { callback(false) }
    })
  },

  _fetchMail: function(url, callback) {
    this.request({
      url: url,
      success: function(resp) {
        if (resp.data) {
          callback(resp.data.children)
        }
      },
      error: function() { callback(false) }
    })
  },

  fetchMail: function(callback) {
    this._fetchMail('http://www.reddit.com/message/unread.json', callback)
  },

  fetchModMail: function(callback) {
    this._fetchMail('http://www.reddit.com/message/moderator.json', callback)
  },

  _queryInfo: function(params, callback) {
    console.log('Performing AJAX info call for ', params)
    params.limit = 1
    this.request({
      url: 'http://www.reddit.com/api/info.json',
      data: params,
      success: function(resp) {
        if (resp.data) {
          this.storeModhash(resp.data.modhash)
          if (resp.data.children.length) {
            var info = resp.data.children[0].data
            this.setURL(info.url, info)
            barStatus.updateInfo(info)
            callback(info)
          } else {
            callback(null)
          }
        } else {
          callback(false, resp)
        }
      }.bind(this),
      error: function() { callback(false) }
    })
  },

  _storedLookup: function(keyName, key, getter, useStored, callback) {
    // Internal rate limited cached info getter.
    //
    // Look up `key` using `getter` and call `callback` with the stored data immediately if
    // `useStored` is true and stored info is available. If stored data is
    // currently in the process of being refreshed or it is older than
    // redditInfo.freshAgeThreshold seconds old, false is returned. Otherwise,
    // the data is fetched from reddit and `callback` is invoked with the
    // result.
    var stored = getter.call(this, key),
        storedAge = 0,
        now = Date.now()
    if (stored) {
      if (useStored) {
        // Return our stored data right away.
        callback(stored)
      }

      if (stored._fake) {
        console.log('Skipping fake info request.')
        return false
      }

      if (this.fetching[stored.name]) {
        console.log('Info already being fetched. Skipping update.', stored)
        return false
      }

      storedAge = Math.floor((now - stored._ts) / 1000)
      if (storedAge < redditInfo.freshAgeThreshold) {
        console.log('Info is', storedAge, 'seconds old. Skipping update.', stored)
        return false
      }

      // Mark that we are fetching the data from reddit
      this.fetching[stored.name] = true
    }

    var queryParams = {age:storedAge}
    queryParams[keyName] = key
    this._queryInfo(queryParams, function() {
      if (stored) { delete this.fetching[stored.name] }
      callback.apply(null, arguments)
    }.bind(this))
    return true
  },

  lookupURL: function(url, useStored, callback) {
    this._storedLookup('url', url, this.getURL, useStored, callback)
  },

  lookupName: function(name, useStored, callback) {
    this._storedLookup('id', name, this.getFullname, useStored, callback)
  },

  _thingAction: function(action, data, callback, isRetry) {
    if (!this.isLoggedIn()) {
      callback(false, 'not logged in')
      return
    }

    if (!this.modhash) {
      if (isRetry) {
        console.log('No modhash after thingAction update. Aborting.')
      }

      console.log('Attempted thingAction without modhash. Updating.')
      this.update(function(success) {
        if (success) {
          redditInfo._thingAction(action, data, callback, true)
        } else {
          console.log('Failed thingAction modhash update. Aborting.')
          callback(false)
        }
      })
    }

    data.uh = this.modhash
    this.request({
      type: 'POST',
      url: 'http://www.reddit.com/api/'+action,
      data: data,
      success: function(resp) { callback(true) },
      error: function() { callback(false) }
    })
  },

  vote: function(fullname, likes, callback) {
    var dir
    if (likes == true) {
      dir = 1
    } else if (likes == false) {
      dir = -1
    } else {
      dir = 0
    }

    this._thingAction('vote', {id:fullname, dir:dir}, callback)
  },

  save: function(fullname, callback) {
    this._thingAction('save', {id:fullname}, callback)
  },

  unsave: function(fullname, callback) {
    this._thingAction('unsave', {id:fullname}, callback)
  },

  isLoggedIn: function() {
    return this.hasCookie
  },

  setLoggedIn: function(hasCookie) {
    this.hasCookie = hasCookie
    console.log('Changed reddit logged in state:', hasCookie)
    if (!hasCookie) {
      this.storeUsername(null)
      this.storeModhash(null)
    }
  },

  init: function() {
    this.user = localStorage['username']
    this.modhash = localStorage['modhash']

    chrome.cookies.get({
      url:'http://www.reddit.com', name:'reddit_session'
    }, function(cookie) {
      redditInfo.setLoggedIn(!!cookie)
    })

    chrome.cookies.onChanged.addListener(function(changeInfo) {
      var cookie = changeInfo.cookie
      if (cookie.domain == '.reddit.com' && cookie.name == 'reddit_session') {
        redditInfo.setLoggedIn(!changeInfo.removed)
      }
    })

    chrome.webRequest.onBeforeRedirect.addListener(function(details) {
      var info = redditInfo.url[details.url]
      if (info) {
        console.log('Detected redirect from', details.url, 'to', details.redirectUrl)
        redditInfo.redirects[details.redirectUrl] = info.name
      }
    }, {urls:['<all_urls>'], types:['main_frame']})
  },

  storeModhash: function(modhash) {
    localStorage['modhash'] = this.modhash = modhash
  },

  storeUsername: function(username) {
    localStorage['username'] = this.user = username
  }
}

function addContent(tab, files, callback) {
  var startTime = Date.now()

  function injectNext() {
    var fileInfo = files.shift()
    if (fileInfo) {
      var extension = fileInfo.file.match(/\.\w+$/)
      extension = extension && extension[0]

      console.log('Injecting', fileInfo.file, fileInfo)
      if (extension == '.js') {
        var inject = chrome.tabs.executeScript
      } else if (extension == '.css') {
        var inject = chrome.tabs.insertCSS
      } else {
        throw 'Invalid file extension.'
      }

        inject(tab.id, fileInfo, function() {
          injectNext()
        })
    } else {
      console.log('Content injection took', Date.now() - startTime, 'ms')
      if (callback) { callback() }
    }
  }

  injectNext()
}

function addOverlayContent(tab, callback) {
  addContent(tab, [
      {file:'pageOverlay.css', runAt:'document_start'},
      {file:'debug.js', runAt:'document_start'},
      {file:'pageOverlay.js', runAt:'document_start'}
  ], callback)
}

tabStatus = {
  tabId: {},
  injecting: {},

  canOverlay: function(tab) {
    return localStorage['allowHttps'] == 'true' || urlProtocol(tab.url) != 'https'
  },

  ensureOverlay: function(tab) {
    var needsOverlay = (localStorage['allowHttps'] == 'true' && urlProtocol(tab.url) == 'https') || urlProtocol(tab.url) == 'http'
    if (needsOverlay && !(tab.id in this.tabId) && !(tab.id in this.injecting)) {
      this.injecting[tab.id] = true
      addOverlayContent(tab)
    }
  },

  add: function(port) {
    var tabId = port.sender.tab.id,
        tabData = {port:port}
    console.log('Tab added', tabId)
    delete this.injecting[tabId]
    this.tabId[tabId] = tabData
    port.onMessage.addListener(this.handleCommand.bind(this, tabId))
    port.onDisconnect.addListener(this.remove.bind(this, tabId))
  },

  setBar: function(tabId, bar) {
    var tabData = this.tabId[tabId]
    if (tabData) {
      tabData.bar = bar
    }
  },

  remove: function(tabId) {
    console.log('Tab removed', tabId)
    delete this.tabId[tabId]
  },

  removeHttps: function() {
    for (var tabId in this.tabId) {
      chrome.tabs.get(Number(tabId), function(tab) {
        if (urlProtocol(tab.url) == 'https') {
          tabStatus.tabId[tab.id].port.disconnect()
        }
      })
    }
  },

  send: function(tabId, msg) {
    var tabData = this.tabId[tabId]
    if (tabData) {
      tabData.port.postMessage(msg)
      return true
    } else {
      return false
    }
  },

  updateTab: function(tab, ensureOverlay) {
    var url = tab.url,
        tabId = tab.id,
        tabData = this.tabId[tabId],
        info = redditInfo.getURL(url)

    setPageActionIcon(tab, info)

    // Manually inject the page overlay if we have permission on https pages.
    if (ensureOverlay && info) {
      this.ensureOverlay(tab)
    }

    if (tabData && tabData.bar) {
      console.log('Updating tab', tabId)
      barStatus.update(tabData.bar, true)
    }
  },

  showInfo: function(tabId, fullname) {
    this.send(tabId, {
      action: 'showInfo',
      fullname: fullname
    })
  },

  showSubmit: function(tabId) {
    this.send(tabId, {
      action: 'showSubmit'
    })
  },

  toggleInfo: function(tabId, fullname) {
    var tabData = this.tabId[tabId]
    if (tabData && tabData.bar) {
      this.showSubmit(tabId)
    } else {
      this.showInfo(tabId, fullname)
    }
  },

  handleCommand: function(tabId, msg) {
    console.log('Received message from tab', tabId, msg)
    switch (msg.action) {
      case 'closeTab':
        chrome.tabs.remove(tabId)
        break
    }
  }
}

barStatus = {
  fullname: {},
  hidden: {},

  add: function(port, fullname) {
    var barData = {port:port, fullname:fullname}
    console.log('Bar added', barData)
    if (!this.fullname[fullname]) {
      this.fullname[fullname] = []
    }
    this.fullname[fullname].push(barData)
    delete this.hidden[barData.fullname]
    port.onMessage.addListener(this.handleCommand.bind(this, barData))
    port.onDisconnect.addListener(this.remove.bind(this, barData))
    tabStatus.setBar(port.sender.tab.id, barData)
  },

  remove: function(barData) {
    console.log('Bar removed', barData)
    var fullname = barData.fullname
    if (fullname) {
      var bars = this.fullname[fullname],
          idx = bars.indexOf(barData)
      if (~idx) { bars.splice(idx, 1) }
      if (!bars.length) {
        delete this.fullname[fullname]
      }
      tabStatus.setBar(barData.port.sender.tab.id, null)
    }
  },

  update: function(barData, stored) {
    redditInfo.lookupName(barData.fullname, stored, function(info) {
      if (!info) { return }
      console.log('Updating bar', barData)
      barData.port.postMessage({
        action: 'update',
        info: info,
        loggedIn: redditInfo.isLoggedIn()
      })
    }.bind(this))
  },

  updateInfo: function(info) {
    if (this.fullname[info.name]) {
      this.fullname[info.name].forEach(function(barData) {
        console.log('Sending updated info to bar', barData, info)
        barData.port.postMessage({
          action: 'update',
          info: info,
          loggedIn: redditInfo.isLoggedIn()
        })
      }, this)
    }
  },

  handleCommand: function(barData, msg) {
    console.log('Received message from bar', barData, msg)
    var updateAfter = function(success) {
      if (!success) {
        barStatus.update(barData, true)
      }
    }
    switch (msg.action) {
      case 'update':
        this.update(barData, msg.useStored)
        break
      case 'vote':
        console.log('Voting', msg)
        redditInfo.vote(barData.fullname, msg.likes, updateAfter)
        break
      case 'save':
      case 'unsave':
        console.log('Modifying', msg)
        redditInfo[msg.action](barData.fullname, updateAfter)
        break
      case 'close':
        this.hidden[barData.fullname] = true
        break
    }
  }
}

function Notifier(url, image, title, text) {
  this.url = url
  this.image = image
  this.title = title
  this.text = text
  this.localStorageKey = 'last-seen:'+url
  this.lastSeen = parseFloat(localStorage[this.localStorageKey]) || 0
}
Notifier.prototype = {
  lastSeen: 0,
  notification: null,

  processMessageList: function(messages, since) {
    var result = {
      count: 0,
      latest_message: {
        created_utc: since
      }
    }

    function processMessages(messages) {
      messages.forEach(function(message) {
        var data = message.data

        if (data.author != redditInfo.user && data.created_utc > since) {
          result.count++
          if (data.created_utc > result.latest_message.created_utc) {
            result.latest_message = data
          }
          console.log('New message: ', data)
        }

        if (data.replies) {
          rv = processMessages(data.replies.data.children)
        }
      })
    }

    processMessages(messages)
    return result
  },

  notify: function(messages) {
    var newIdx = null,
        newCount = 0

    var data = this.processMessageList(messages, this.lastSeen)
    localStorage[this.localStorageKey] = this.lastSeen = data.latest_message.created_utc

    console.log('New messages: ', data.count)

    var n = this.createNotification(data)

    if (n) {
      this.clear()
      this.showNotification(n)
    }
  },

  createNotification: function(data) {
    var substPlural = function(text) {
      return text.replace('{count}', data.count).replace('{s}', data.count > 1 ? 's' : '')
    }

    var title, text, info, isRich = false

    if (data.count > 1) {
      isRich = false
    } else if (data.count == 1) {
      isRich = (localStorage['notificationPrivacy'] != 'true')
    } else {
      return null
    }

    if (isRich) {
      return webkitNotifications.createHTMLNotification(
        'mail-notification.html#'+JSON.stringify({
          title: substPlural(this.title),
          image: this.image,
          message: data.latest_message
        })
      )
    } else {
      return webkitNotifications.createNotification(
        this.image,
        substPlural(this.title),
        substPlural(this.text)
      )
    }
  },

  clear: function() {
    if (this.notification) {
      this.notification.cancel()
    }

    this.notification = null
  },

  showNotification: function(n) {
    this.notification = n

    if (localStorage['notifyTimeout'] == 'true') {
      setTimeout(function() {
        n.cancel()
      }, parseInt(localStorage['notifyTime'])*1000)
    }

    this.notification.onclick = function() {
      window.open(this.url)
      n.cancel()
    }.bind(this)

    this.notification.show()
  },

  demo: function() {
    var data = {
      count: 1,
      latest_message: {
        author: 'test_sender',
        subject: 'test',
        dest: 'tester',
        body: 'hello! how are you?\n\n#heading 1\n##heading 2\n###heading 3\n####heading 4\n#####heading 5\n######heading 6\n\nhello, world!\n\n    hello, code.\n\n*farewell.*',
        body_html: '<div class=\"md\"><p>hello! how are you?</p><h1>heading 1</h1>\n\n<h2>heading 2</h2>\n\n<h3>heading 3</h3>\n\n<h4>heading 4</h4>\n\n<h5>heading 5</h5>\n\n<h6>heading 6</h6>\n\n<p>hello, world!</p>\n\n<pre><code>hello, code.\n</code></pre>\n\n<p><em>farewell.</em></p>\n</div>',
        subreddit: 'test',
      }
    }
    this.showNotification(this.createNotification(data))
    data.count = 2
    this.showNotification(this.createNotification(data))
  }
}

mailNotifier = new Notifier(
  'http://www.reddit.com/message/unread/',
  'images/reddit-mail.svg',
  'reddit: new message{s}!',
  'You have {count} new message{s}.'
)

modmailNotifier = new Notifier(
  'http://www.reddit.com/message/moderator/',
  'images/reddit-modmail.svg',
  'reddit: new modmail!',
  'You have {count} new moderator message{s}.'
)

mailChecker = {
  checkInterval: 5*60*1000,

  interval: null,
  start: function() {
    if (!this.interval) {
      console.log('Starting periodic mail check.')
      this.interval = window.setInterval(this.check, this.checkInterval)
      this.check()
    }
  },
  stop: function() {
    if (this.interval) {
      console.log('Stopping periodic mail check.')
      window.clearInterval(this.interval)
      this.interval = null
    }
  },
  check: function() {
    redditInfo.update(function(info) {
      if (info.has_mail) {
        redditInfo.fetchMail(mailNotifier.notify.bind(mailNotifier))
      } else {
        mailNotifier.clear()
      }

      if (localStorage.checkModMail == 'true' && info.has_mod_mail) {
        redditInfo.fetchModMail(modmailNotifier.notify.bind(modmailNotifier))
      } else {
        modmailNotifier.clear()
      }
    })
  }
}

var protocolRe = /^(\w+):.*/
function urlProtocol(url) {
  var match = url && url.match(protocolRe)
  return match && match[1]
}

function setPageActionIcon(tab, info) {
  if (localStorage['showPageAction'] != 'true') {
    chrome.pageAction.hide(tab.id)
    return
  }

  if (!tabStatus.canOverlay(tab)) {
    chrome.pageAction.setIcon({tabId:tab.id, path:'/images/pageaction-disabled.png'})
    chrome.pageAction.setTitle({tabId:tab.id, title:'Companion is disabled on secure pages (enable in the options)'})
    chrome.pageAction.show(tab.id)
    return
  }

  var protocol = urlProtocol(tab.url)
  if (protocol == 'http' || protocol == 'https') {
    var iconPath = info ? '/images/pageaction.png' : '/images/pageaction-inactive.png'
    chrome.pageAction.setIcon({tabId:tab.id, path:iconPath})
    chrome.pageAction.setTitle({tabId:tab.id, title:'Show reddit information'})
    chrome.pageAction.show(tab.id)
  } else {
    chrome.pageAction.hide(tab.id)
  }
}

var workingPageActions = {}
function onActionClicked(tab) {
  if (!tabStatus.canOverlay(tab) || tab.id in workingPageActions) { return }
  workingPageActions[tab.id] = true

  var frame = 0
  var workingAnimation = window.setInterval(function() {
    try {
      chrome.pageAction.setIcon({tabId:tab.id, path:'/images/working'+frame+'.png'})
    } catch (exc) {
      window.clearInterval(arguments.callee)
    }
    frame = (frame + 1) % 6
  }, 200)

  redditInfo.lookupURL(tab.url, true, function(info) {
    window.clearInterval(workingAnimation)
    tabStatus.updateTab(tab, true)
    delete workingPageActions[tab.id]

    if (info) {
      tabStatus.toggleInfo(tab.id, info.name)
    } else {
      tabStatus.showSubmit(tab.id)
    }
  })
}

chrome.pageAction.onClicked.addListener(onActionClicked)
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    tabStatus.updateTab(tab)
  })
})
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  tabStatus.updateTab(tab, true)
})

chrome.extension.onRequest.addListener(function(request, sender, callback) {
  switch (request.action) {
    case 'thingClick':
      console.log('Thing clicked', request)
      redditInfo.setURL(request.url, request.info)
      break
  }
})

chrome.extension.onConnect.addListener(function(port) {
  tag = port.name.split(':')
  name = tag[0]
  data = tag[1]
  switch (name) {
    case 'overlay':
      tabStatus.add(port)
      var tab = port.sender.tab,
          info = redditInfo.getURL(tab.url)
      if (info) {
        if (localStorage['autoShow'] == 'false') {
          console.log('Auto-show disabled. Ignoring reddit page', info)
        } else if (localStorage['autoShowSelf'] == 'false' && info.is_self) {
          console.log('Ignoring self post', info)
        } else if (!tabStatus.canOverlay(tab)) {
          console.log('Https page. Ignoring', info)
        } else if (barStatus.hidden[info.name]) {
          console.log('Bar was closed on this page. Ignoring.', info)
        } else {
          console.log('Recognized page '+tab.url, info)
          tabStatus.showInfo(tab.id, info.name)
        }
      }
      break
    case 'bar':
      barStatus.add(port, data)
      break
  }
})

window.addEventListener('storage', function(e) {
  switch (e.key) {
    case 'checkMail':
      if (e.newValue == 'true') {
        mailChecker.start()
      } else {
        mailChecker.stop()
      }
      break
    case 'allowHttps':
      if (e.newValue == 'false') {
        tabStatus.removeHttps()
      }
    case 'showPageAction':
      setAllPageActionIcons()
      break
  }
}, false)

// Show page action for existing tabs.
function setAllPageActionIcons() {
  chrome.windows.getAll({populate:true}, function(wins) {
    wins.forEach(function(win) {
      win.tabs.forEach(function(tab) {
        setPageActionIcon(tab, redditInfo.getURL(tab.url))
      })
    })
  })
}

initOptions()
console.log('Shine loaded.')
redditInfo.init()
if (localStorage['showPageAction'] == 'true') {
  setAllPageActionIcons()
}
if (localStorage['checkMail'] == 'true') {
  mailChecker.start()
} else {
  redditInfo.update()
}
