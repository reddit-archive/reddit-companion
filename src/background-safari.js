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

 /*Data Structure to keep track of tabs that are monitoring reddit so we can update their arrows*/
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