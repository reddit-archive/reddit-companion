function initOptions() {
  defaultOptions = {
    'showTooltips': true,
    'ignoreSelfPosts': false
  }

  for (key in defaultOptions) {
    if (localStorage[key] == undefined) {
      localStorage[key] = defaultOptions[key]
    }
  }
}

redditInfo = {
  getURL: function(url) {
    return this.url[url]
  },
  
  setURL: function(url, info) {
    this.url[url] = info
    this.fullname[info.name] = info
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
          console.log('Updated reddit info', resp.data)
          this.storeModhash(resp.data.modhash)
          callback(resp.data)
        }
      }.bind(this),
      error: function() { callback(false) }
    })
  },

  fetchMail: function(callback) {
    this.request({
      url: 'http://www.reddit.com/message/unread.json',
      success: function(resp) {
        if (resp.data) {
          callback(resp.data.children)
        }
      },
      error: function() { callback(false) }
    })
  },

  _queryInfo: function(params, callback) {
    console.log('Performing AJAX info call for ', params)
    params.limit = 1
    this.request({
      url: 'http://www.reddit.com/api/info.json',
      data: params,
      success: function(resp) {
        if (resp.data) {
          redditInfo.modhash = resp.data.modhash
          if (resp.data.children.length) {
            var info = resp.data.children[0].data
            redditInfo.setURL(info.url, info)
            barStatus.updateInfo(info)
          }
          if (callback) { callback(info) }
        }
      },
      error: function() {
        if (callback) { callback(null) }
      }
    })
  },

  lookupURL: function(url, callback) {
    this._queryInfo({url:url}, callback)
  },


  lookupName: function(name, callback) {
    this._queryInfo({id:name}, callback)
  },

  _storedLookup: function(key, array, lookup, callback) {
    var stored = array[key]
    if (stored) {
      // Return our stored data right away, refreshing in the background.
      callback(stored)
      lookup(key)
    } else {
      lookup(key, callback)
    }
  },

  lookupURLStored: function(url, callback) {
    this._storedLookup(url, this.url, this.lookupURL.bind(this), callback)
  },

  lookupNameStored: function(name, callback) {
    this._storedLookup(name, this.fullname, this.lookupName.bind(this), callback)
  },

  _thingAction: function(action, data, callback) {
    if (!this.isLoggedIn()) { callback(false, 'not logged in') }
    
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
    // TODO: check for cookie
    return this.modhash != null && this.modhash != ''
  },

  init: function() {
    this.modhash = localStorage['modhash']
  },
    
  storeModhash: function(modhash) {
    localStorage['modhash'] = this.modhash = modhash
  },

  url: {}, 
  fullname: {},
  lastMailCheckTime: null
}

tabStatus = {
  tabId: {},

  add: function(port) {
    var tabId = port.sender.tab.id,
        tabData = {port:port}
    console.log('Tab added', tabId)
    this.tabId[tabId] = tabData
    port.onDisconnect.addListener(this.remove.bind(this, tabId))
  },

  addBar: function(tabId, bar) {
    var tabData = this.tabId[tabId]
    if (tabData) {
      tabData.bar = bar
    }
  },

  remove: function(tabId) {
    console.log('Tab removed', tabId)
    var fullname = this.tabId[tabId].fullname
    delete this.tabId[tabId]
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

  _showInfo: function(tabId, fullname) {
    this.send(tabId, {
      action: 'showInfo',
      fullname: fullname
    })
  },
  
  updateTab: function(tabId) {
    var tabData = this.tabId[tabId]
    if (tabData && tabData.bar) {
      console.log('Updating tab', tabId)
      barStatus.update(tabData.bar)
    }
  },

  showInfo: function(tabId, fullname) {
    this._showInfo(tabId, fullname)
  },

  showSubmit: function(tabId) {
    this.send(tabId, {
      action: 'showSubmit'
    })
  }
}

barStatus = {
  fullname: {},

  add: function(port, fullname) {
    var barData = {port:port, fullname:fullname}
    console.log('Bar added', barData)
    if (!this.fullname[fullname]) {
      this.fullname[fullname] = []
    }
    this.fullname[fullname].push(barData)
    port.onMessage.addListener(this.handleCommand.bind(this, barData))
    port.onDisconnect.addListener(this.remove.bind(this, barData))
    tabStatus.addBar(port.sender.tab.id, barData)
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
    }
  },

  update: function(barData, stored) {
    var lookup = stored ? 'lookupNameStored' : 'lookupName'
    redditInfo[lookup](barData.fullname, function(info) {
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
        this.update.bind(this, barData)
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
      }
  }
}

mailNotifier = {
  newCount: 0,
  lastSeen: null,
  notify: function(messages) {
    var newIdx = null,
        lastSeen = this.lastSeen,
        newCount = 0
    for (i = 0; i < messages.length; i++) {
      var messageTime = messages[i].data.created_utc*1000
      if (!lastSeen || messageTime > lastSeen) {
        newCount++
        if (!newIdx) { newIdx = i }
        this.lastSeen = Math.max(this.lastSeen, messageTime)
      }
    }
    this.newCount += newCount

    console.log('New messages: ', newCount, this.newCount)

    var title, text
    if (newCount == 1) {
      var message = messages[newIdx]
      title = message.data.author + ': ' + message.data.subject
      text = message.data.body
    } else if (newCount > 1) {
      title = 'reddit: new messages!'
      text = 'You have ' + this.newCount + ' new messages.'
    }

    if (newCount > 0) {
      this.showNotification(title, text)
    }
  },

  clear: function() {
    this.newCount = 0
    if (this.notification) {
      this.notification.cancel()
    }
  },

  notification: null,
  showNotification: function(title, text) {
    if (this.notification) {
      this.notification.cancel()
    }

    var n = this.notification =
      webkitNotifications.createNotification('images/reddit_mail_icon.svg', title, text)

    this.notification.onclick = function() {
      window.open('http://www.reddit.com/message/unread/')
      n.cancel()
    }

    this.notification.show()
  }
}

function setPageActionIcon(tab) {
  if (/^http:\/\/.*/.test(tab.url)) {
    var info = redditInfo.url[tab.url]
    if (info) {
      chrome.pageAction.setIcon({tabId:tab.id, path:'/images/reddit.png'})
    } else { 
      chrome.pageAction.setIcon({tabId:tab.id, path:'/images/reddit-inactive.png'})
    }
    chrome.pageAction.show(tab.id)
    return info
  }
}

function onActionClicked(tab) {
  var frame = 0
  var workingAnimation = window.setInterval(function() {
    try {
      chrome.pageAction.setIcon({tabId:tab.id, path:'/images/working'+frame+'.png'})
    } catch (exc) {
      window.clearInterval(arguments.callee)
    }
    frame = (frame + 1) % 6
  }, 200)
  
  redditInfo.lookupURLStored(tab.url, function(info) {
    window.clearInterval(workingAnimation)
    setPageActionIcon(tab)
    
    if (info) {
      tabStatus.showInfo(tab.id, info.name)
    } else {
      tabStatus.showSubmit(tab.id)
    }
  })
}

chrome.tabs.onSelectionChanged.addListener(tabStatus.updateTab.bind(tabStatus))
chrome.pageAction.onClicked.addListener(onActionClicked)

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
          info = setPageActionIcon(tab)
      if (info) {
        if (localStorage['ignoreSelfPosts'] == 'true' && info.is_self) {
          console.log('Ignoring self post', info)
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

// Show page action for existing tabs.
chrome.windows.getAll({populate:true}, function(wins) {
  wins.forEach(function(win) {
    win.tabs.forEach(function(tab) {
      setPageActionIcon(tab)
    })
  })
})

function checkMail() {
  redditInfo.update(function(info) {
    if (info.has_mail) {
      redditInfo.fetchMail(mailNotifier.notify.bind(mailNotifier))
    } else {
      mailNotifier.clear()
    }
  })
}

initOptions()
console.log('Shine loaded.')
redditInfo.init()
window.setInterval(checkMail, 5*60*1000)
checkMail()
