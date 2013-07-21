function initOptions() {
  defaultOptions = {
    'autoShow': true,
    'autoShowSelf': true,
    'showTooltips': true,
    'checkMail': true,
  }

  for (key in defaultOptions) {
    if (localStorage[key] == undefined) {
      localStorage[key] = defaultOptions[key]
    }
  }
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
  hidden: {},

  add: function(port, fullname) {
    var barData = {port:port, fullname:fullname}
    console.log('Bar added', barData)
    if (!this.fullname[fullname]) {
      this.fullname[fullname] = []
    }
    this.fullname[fullname].push(barData)
    if (this.hidden[barData.fullname]) {
      delete this.hidden[barData.fullname]
    }
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
    redditInfo.lookupName(barData.fullname, stored, function(info) {
      if (info == null) { return }
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
      case 'close':
        this.hidden[barData.fullname] = true
        break
    }
  }
}

function setPageActionIcon(tab) {
  if (/^http:\/\/.*/.test(tab.url)) {
    var info = redditInfo.getURL(tab.url)
    if (info) {
      chrome.pageAction.setIcon({tabId:tab.id, path:'/images/reddit.png'})
    } else { 
      chrome.pageAction.setIcon({tabId:tab.id, path:'/images/reddit-inactive.png'})
    }
    chrome.pageAction.show(tab.id)
    return info
  }
}

var workingPageActions = {}
function onActionClicked(tab) {
  if (tab.id in workingPageActions) { return }
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
    setPageActionIcon(tab)
    delete workingPageActions[tab.id]
    
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
        if (localStorage['autoShow'] == 'false') {
          console.log('Auto-show disabled. Ignoring reddit page', info)
        } else if (localStorage['autoShowSelf'] == 'false' && info.is_self) {
          console.log('Ignoring self post', info)
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
  if (e.key == 'checkMail') {
    if (e.newValue == 'true') {
      mailChecker.start()
    } else {
      mailChecker.stop()
    }
  }
}, false)

// Show page action for existing tabs.
chrome.windows.getAll({populate:true}, function(wins) {
  wins.forEach(function(win) {
    win.tabs.forEach(function(tab) {
      setPageActionIcon(tab)
    })
  })
})

initOptions()
console.log('Shine loaded.')
redditInfo.init()
if (localStorage['checkMail'] == 'true') {
  mailChecker.start()
} else {
  redditInfo.update()
}
