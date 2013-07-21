function initOptions() {
  defaultOptions = {
    'autoShow': true,
    'autoShowSelf': true,
    'showTooltips': true,
    'checkMail': true,
  }
  localStorage['autoShow'] = safari.extension.settings.autoShow;
  localStorage['autoShowSelf'] = safari.extension.settings.autoShowSelf;
  localStorage['showTooltips'] = safari.extension.settings.showTooltips;
  localStorage['checkMail'] = safari.extension.settings.checkMail;


}


barStatus = {
  fullname: {},
  hidden: {},

  add: function(port, fullname,id) {
    //need to iterate to get the atual id for this port....
    var barData = {port:port, fullname:fullname,id:id}
    console.log('Bar added', barData)
    if (!this.fullname[fullname]) {
      this.fullname[fullname] = []
    }
    this.fullname[fullname].push(barData)
    if (this.hidden[barData.fullname]) {
      delete this.hidden[barData.fullname];
    }
    /*port.onMessage.addListener(this.handleCommand.bind(this, barData))
    port.onDisconnect.addListener(this.remove.bind(this, barData))
    tabStatus.addBar(port.sender.tab.id, barData)*/
    tabStatus.addBar(id,barData);
    return barData;
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
      barData.port.page.dispatchMessage('update',{info:info,loggedIn:redditInfo.isLoggedIn()});
    }.bind(this))
  },
  
  updateInfo: function(info) {
    if (this.fullname[info.name]) {
      this.fullname[info.name].forEach(function(barData) {
        console.log('Sending updated info to bar', barData, info)
        barData.port.page.dispatchMessage('update',{info:info,loggedIn:redditInfo.isLoggedIn()});
      }, this)
    }
  },

  handleCommand: function(barData, msg) {
    //console.log('Received message from bar', barData, msg)
    var updateAfter = function(success) {
      if (!success) {
        this.update.bind(this, barData)
      }else{
        redditInfo.reset(barData.fullname);
        redditStatus.update(barData);
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

tabStatus = {
  tabId: {},

  add: function(target,url) {
    var tabId = this.searchForID(target), tabData
    //need to see if we have this tab yet - if so, simply return that tab id - if not make a new one and add it
    if(!tabId)
      tabId = _createID();
    tabData= {port:target,url:url,id:tabId};
    this.tabId[tabId] = tabData;
    target.addEventListener("close", this.remove.bind(this, tabId), false);
    return tabId;
    
  },

  addBar: function(tabId, bar) {
    var tabData = this.tabId[tabId]
    if (tabData) {
      tabData.bar = bar
    }
  },

  remove: function(tabId) {
    if(this.tabId[tabId]){
      console.log('Tab removed', tabId)
      //var fullname = this.tabId[tabId].fullname
      delete this.tabId[tabId]
      //console.log(this.tabId);
    }
  },

  send: function(tabId, msg) {
    var tabData = this.tabId[tabId];
    //console.log(tabId,msg,tabData,this.tabId);
    if(tabData){
      tabData.port.page.dispatchMessage(msg.action,msg);
      return true;
    }else{
      return false;
    }
    //tab.page.dispatchMessage(msg.action,msg);

  },

  _showInfo: function(tabId, info) {
    this.send(tabId, {
      id: tabId,
      action: 'showInfo',
      info: info
    })
  },
  
  updateTab: function(tabId) {
    var tabData = this.tabId[tabId]
    if (tabData && tabData.bar) {
      console.log('Updating tab', tabId)
      barStatus.update(tabData.bar)
    }
  },

  showInfo: function(tabId, info) {

    this._showInfo(tabId, info)
  },

  showSubmit: function(tabId) {
    this.send(tabId, {
      action: 'showSubmit',
      id: tabId
    })
  },
  searchForID: function(tab){
    for(var key in this.tabId){
          if(this.tabId[key].port == tab){
            return key;
          }
      }
      return false;
  }
  
}
 /*DS to keep track of tabs that are monitoring reddit so we can update their arrows*/
redditStatus = {
tabs :{},
  add: function(target) {
    var tabId = this.searchForID(target)
    //need to see if we have this tab yet - if so, simply return that tab id - if not make a new one and add it
    if(!tabId){
      tabId = _createID();
      this.tabs[tabId] = target;
      target.addEventListener("close", this.remove.bind(this, tabId), false);
    }
    return tabId;
  },
  update: function(data){
    redditInfo.lookupName(data.fullname, false, function(info) {
      if (info == null) { return }
      console.log('Updating Reddit Tabs', info)
      for(var key in this.tabs){
         //send update message
         this.tabs[key].page.dispatchMessage('update',{info:info,loggedIn:redditInfo.isLoggedIn()});
      }
    }.bind(this))
  },
  remove: function(tabId) {
    if(this.tabs[tabId]){
      console.log('Reddit Tab removed', tabId)
      //var fullname = this.tabId[tabId].fullname
      delete this.tabs[tabId]
      //console.log(this.tabId);
    }
  },
  searchForID: function(tab){
    for(var key in this.tabs){
          if(this.tabs[key] == tab){
            return key;
          }
      }
      return false;
  }

}

safari.application.addEventListener("message",function(messageEvent) {
  //console.log('Received Message: ' + messageEvent.name,messageEvent);
  switch (messageEvent.name) {
    case 'redditConnect':
      console.log("Reddit Shine Tab Connected");
      redditStatus.add(messageEvent.target);
    break;
    case 'thingClick':
      var request = messageEvent.message;
      console.log('Thing clicked', messageEvent.message);
      redditInfo.setURL(request.url, request.info)
      break;
    case 'connect':
      var url = messageEvent.message.url;
      var id = tabStatus.add(messageEvent.target,url);
      var info = redditInfo.getURL(url);
      if (info) {
        if (localStorage['autoShow'] == 'false') {
          console.log('Auto-show disabled. Ignoring reddit page', info)
        } else if (localStorage['autoShowSelf'] == 'false' && info.is_self) {
          console.log('Ignoring self post', info)
        } else if (barStatus.hidden[info.name]) {
          console.log('Bar was closed on this page. Ignoring.', info)
        } else {
          console.log('Recognized page '+url, info)
          tabStatus.showInfo(id,info);
        }
      }
      break;
      /**Bar messags - since we can't apply publish/subscribe - they're global messages now**/
    case 'bar':
      var barAction = messageEvent.message.action;
      var barId = messageEvent.message.id;
      var name = messageEvent.message.fullname;
      switch(barAction){
        case 'connect':
          //get name from info for tabId matching this....
          var barData = barStatus.add(messageEvent.target, name,barId);
          //need to send an update message 
          if(barData){
            barStatus.handleCommand(barData,{action:'update',useStored:'true'});
          }
        break;
        case 'close':
          var barData = tabStatus.tabId[barId].bar;
          if(barData){
            barStatus.handleCommand(barData,{action:'close'});
          }
        break;
        case 'update':
        var barData = tabStatus.tabId[barId].bar;
          if(barData){
            barStatus.handleCommand(barData,{action:'update',useStored:messageEvent.message.useStored});
          }
        break;
        case 'vote':
        var barData = tabStatus.tabId[barId].bar;
          if(barData){
            barStatus.handleCommand(barData,{action:'vote',likes:messageEvent.message.likes});
          }
        break;
        case 'save':
        var barData = tabStatus.tabId[barId].bar;
          if(barData){
            barStatus.handleCommand(barData,{action:'save'});
          }
        break;
        case 'unsave':
        var barData = tabStatus.tabId[barId].bar;
          if(barData){
            barStatus.handleCommand(barData,{action:'unsave'});
          }
        break;
      }
    break;

  }
},false);

/*Toolbar button press*/
var workingPageActions = {}
safari.application.addEventListener("command", function(event){
  var tab = event.target.browserWindow.activeTab;
  //console.log("Active Tab",tab);
  if (tab in workingPageActions) { return }
    workingPageActions[tab] = true
    redditInfo.lookupURL(tab.url, true, function(info) {
    delete workingPageActions[tab]
    //console.log("Info Result:",info);
    var tabId = tabStatus.searchForID(tab);
    if (info) {
      tabStatus.showInfo(tabId,info); 
    } else {
      tabStatus.showSubmit(tabId);
    }
  })

}, false);
/**Settings handling*/
safari.extension.settings.addEventListener("change", function(event){
  localStorage[event.key] = event.newValue;
  if (event.key == 'checkMail') {
    if (event.newValue == 'true') {
      mailChecker.start()
    } else {
      mailChecker.stop()
    }
  }

}, false);

initOptions();
console.log('Shine loaded.');
redditInfo.init()
if (localStorage['checkMail'] == 'true' && Notification) {
  mailChecker.start()
} else {
  redditInfo.update()
}

function _createID(){
    return (_S4() + _S4() + "-" + _S4() + "-4" + _S4().substr(0,3) + "-" + _S4() + "-" + _S4() + _S4() + _S4()).toLowerCase()+ "-" + Date.now();
  }

function _S4(){
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  }